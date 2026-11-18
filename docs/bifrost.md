---
layout: docs
title: "Bifrost Gateway"
permalink: /docs/bifrost/
---

{% raw %}
[Bifrost](https://github.com/maximhq/bifrost) is a compiled Go binary that exposes a unified LLM gateway — OpenAI-format requests on `/v1` plus provider-native passthroughs (e.g. `/anthropic`). By default Vigil routes LLM traffic through Bifrost so caching, cost tracking, and budget enforcement live in one place.

## How Vigil uses Bifrost

There are two Bifrost entry points, used by different call paths:

- **LLMRouter** (`core/llm/router/router.py`) routes **all** providers — including Anthropic — via Bifrost's OpenAI-format `/v1` surface, through `_dispatch_bifrost_openai` with `base_url` set to `{BIFROST_URL}/v1`. Anthropic used to take Bifrost's `/anthropic` passthrough to keep extended thinking and `cache_control`; both were traded away (ADR 0011), and by #632 nothing asked for either.
- **The Anthropic SDK client factory** (`core/llm/providers/clients.py`) is where the `/anthropic` passthrough survives: `create_anthropic_client` / `create_async_anthropic_client` point the regular Anthropic SDK at Bifrost's Anthropic-compatible passthrough at `{BIFROST_URL}/anthropic` by default.

The single source of truth for Anthropic client construction is `core/llm/providers/clients.py` — the repo's real `Anthropic(...)` / `AsyncAnthropic(...)` constructions are in that module. Its docstring names `services/api/routers/llm_providers.py` as a key-validation exception, but at 1.1.2 that router contains no direct `Anthropic(` call and no upstream key-validation call — only shape validation and CRUD handlers that schedule a catalog resync.

There is a bypass: when `ANTHROPIC_BASE_URL` is set, `clients.py` points the SDK straight at that override, bypassing Bifrost for Anthropic traffic (for deployments where Bifrost cannot reach the Anthropic upstream and an internal Anthropic-compatible proxy must be used instead).

## Starting Bifrost

Bifrost is always-on — the compose file at `infra/docker/docker-compose.yml` brings it up alongside the rest of the stack:

```bash
docker compose -f infra/docker/docker-compose.yml up postgres redis bifrost backend llm-worker
```

Health check: `curl http://localhost:8080/health`.

## Configuration

`infra/docker/bifrost/config.json` declares the providers and the models Bifrost will expose; it contains no cache block. API keys are **not** written into the config file. The only `env.*` references in it are `env.BIFROST_ADMIN_PASSWORD` (governance) and `env.OLLAMA_URL` (the ollama key); the hosted providers (anthropic, openai, gemini, vertex) declare `"keys": []` there. Their keys arrive via the compose `environment:` block and are pushed to Bifrost at startup by `sync_env_provider_keys` (`core/llm/bifrost/admin.py`). Vigil's backend reads per-provider keys from its own `secrets_manager`; what's in Bifrost's env are the fallback/default keys used when a provider row in `llm_provider_configs` doesn't override them.

### Model allow-list: runtime sync, not the config file

The only seeded `models` array in `config.json` is ollama's `["*"]` (see below); the hosted providers have no `keys[0]` in the file at all — their allow-lists are pushed at runtime. The backend runs `sync_all_provider_models()` ([core/llm/bifrost/admin.py](https://github.com/Vigil-SOC/vigil/blob/main/core/llm/bifrost/admin.py)) which:

1. Queries each upstream provider's live catalog (Anthropic `/v1/models`, OpenAI `/v1/models`, Ollama `/api/tags`) via [core/llm/providers/discovery.py](https://github.com/Vigil-SOC/vigil/blob/main/core/llm/providers/discovery.py).
2. Writes the per-row list into the backend's dropdown cache (`_MODEL_LIST_CACHE` in [core/llm/providers/registry.py](https://github.com/Vigil-SOC/vigil/blob/main/core/llm/providers/registry.py)).
3. Unions the model IDs across all active providers of the same type and upserts that union to Bifrost's admin API via the keys subresource — `_upsert_provider_key` writes to `/api/providers/{name}/keys`. Keys live at that subresource, not on the `/api/providers/{name}` document, which returns no `keys` field at all.

**Single source of truth.** `sync_all_provider_models()` is the only writer to both caches — the UI dropdown and Bifrost's allow-list come from the same call over the same upstream fetch, so they cannot drift. `fetch_provider_models()` on the read path is a pure cache lookup that falls back to a lazy sync on a cold-start miss.

**When it runs:**
- At backend startup — launched as a background task ([services/api/main.py](https://github.com/Vigil-SOC/vigil/blob/main/services/api/main.py) startup handler).
- **Periodically** — `MODEL_CATALOG_REFRESH_INTERVAL_S` (default 300s / 5min). Set to `0` to disable the loop and only sync once at startup.
- Whenever a provider is added, updated, or deleted via the Providers UI — CRUD handlers invalidate the cache and schedule a background resync (`_schedule_catalog_resync`).

The bootstrap list in `config.json` only matters for the cold-start window (seconds) before the first sync iteration completes, or for environments where the backend can't reach upstream at startup.

### Local Ollama: wildcard routing + private-network access

Self-hosted Ollama serves whatever the user has pulled or built, so a
finite discovered allow-list is wrong — a custom model (e.g.
`qwythos-custom:latest`) would 400 with "no keys found that support model".
Two settings make local Ollama route reliably:

- **Wildcard allow-list.** The ollama key uses `"models": ["*"]` in
  `config.json`. That seeded wildcard is static: `sync_provider_models()`
  leaves ollama (and vertex) alone — they are in
  `_UNMANAGED_PROVIDER_TYPES`, so sync returns early and writes nothing
  for them — and routing never depends on `/api/tags` enumerating a
  custom model.
- **`network_config.allow_private_network: true`.** Bifrost blocks RFC1918
  targets (10.x, 172.16.x, 192.168.x) by default. In the container path
  `OLLAMA_URL` resolves to `host.docker.internal` → the Docker Desktop
  gateway (`192.168.65.254`, RFC1918), so the flag is required or every
  call fails with "connection to private IP … is not allowed". It belongs
  in the provider's `network_config`, **not** at the key level — Bifrost's
  schema silently drops the key-level form. Loopback (`127.0.0.1`, `::1`)
  is always allowed regardless.

Bifrost seeds `/app/data/config.db` (SQLite) from `config.json` only on
first boot; the live store lives on the named `bifrost_data` volume
(`bifrost_data:/app/data`), so runtime changes survive restarts and
recreates. `config.json` is a first-boot seed, not the live config.

### Legacy / non-listed models (extras)

Some upstream providers drop older model IDs from their `/v1/models` listing even when those IDs are still callable (Anthropic did this with the Claude 3.x family). To surface those in the UI and let Bifrost route traffic for them, the backend unions a configurable "extras" set into both the dropdown and Bifrost's allow-list. Extras are flagged `deprecated=True` in the API response so the UI can badge them.

The defaults live in [core/llm/providers/registry.py](https://github.com/Vigil-SOC/vigil/blob/main/core/llm/providers/registry.py) (`_DEFAULT_EXTRA_MODELS`) and currently cover Claude 3.5 Haiku, 3.5 Sonnet v2, and 3 Haiku, plus legacy Claude Sonnet 4 / Opus 4 IDs. Override per deployment via env:

- `ANTHROPIC_EXTRA_MODELS="id1,id2,..."` — replaces the default list.
- `ANTHROPIC_EXTRA_MODELS=""` — disables extras for Anthropic entirely.
- `OPENAI_EXTRA_MODELS="..."` — same mechanism for OpenAI if you need it.

### Logging — cost source (#185)

The config at `infra/docker/bifrost/config.json` enables Bifrost's
logging explicitly with a local SQLite store (`/app/data/logs.db`
inside the Bifrost container, on the `bifrost_data` volume). Vigil's
served cost analytics do **not** come from Bifrost's logs, however:
`GET /api/analytics/cost` returns totals and a per-model grouping of
local `LLMInteractionLog` rows via `get_cost_breakdown()` — it does not
proxy a Bifrost logs endpoint.

**Per-call correlation:** Vigil attaches a custom header
`x-bf-lh-vigil-interaction-id: <uuid>` to every upstream call (the
`x-bf-lh-*` prefix is Bifrost's logging-headers convention). The UUID
lands in Bifrost's `LogEntry.metadata` field for manual audit. We do
**not** wire automated per-call cost reconcile from Bifrost back into
`LLMInteractionLog.cost_usd` because Bifrost's `GET /api/logs` query
parameters don't currently support filtering by custom metadata —
reconciling would require pulling a time-window of logs and matching
locally on `(model, timestamp, token_counts)`, which is brittle.
Local `compute_call_cost()` remains the synchronous source for
`LLMInteractionLog.cost_usd` and for the analytics endpoint above.

**Production: switch to Postgres.** SQLite is fine for dev (the default
config above); for production set:

```json
{
  "logs_store": {
    "enabled": true,
    "type": "postgres",
    "config": {
      "host": "postgres",
      "port": "5432",
      "user": "bifrost",
      "password": "<secret>",
      "db_name": "bifrost_logs"
    }
  }
}
```

Reuse the existing `postgres` service in `docker-compose.yml` with a
separate database (UTF8 required by Bifrost). Inject the password via
your secrets manager — same pattern as the provider API keys above.

### Caching — two layers

Vigil benefits from two independent caching layers. They're **complementary**, not redundant:

| Layer | What it caches | Hit rate in practice | Savings | Run by |
|---|---|---|---|---|
| Anthropic native prompt caching (GH #84 PR-C) | Request prefix (system prompt + tool schemas) | Most calls within a session | ~90% on cached input tokens | Anthropic |
| Bifrost semantic cache (optional) | Full responses, keyed on embedding similarity | Only semantically similar retries | 100% on hit | Bifrost + Redis vector store |

**Anthropic prefix caching.** On the SDK client path, `clients.py`
describes Bifrost's `/anthropic` passthrough as preserving
`cache_control` blocks and the cache-token usage counters. No
prompt-cache enable env var, Settings kill-switch, or marker-adding
function exists in the code for this:
`core/llm/harness/claude.py` only accounts `cache_read_tokens` /
`cache_creation_tokens`. On the LLMRouter `/v1` path, `cache_control`
was traded away (see "How Vigil uses Bifrost" above).

**Bifrost's semantic cache** is opt-in and configured through the Bifrost UI at http://localhost:8080 (not via `infra/docker/bifrost/config.json`). The pinned Bifrost version is v2.2.1. Enabling it requires:

1. A vector store (Redis recommended — reuse the existing Redis, a separate DB number)
2. An embedding provider (OpenAI `text-embedding-3-small` or a local Ollama model)
3. Enabling the `semantic_cache` plugin in the UI

Vigil's unified routing does **not** depend on this layer — it's optional cost gravy on top of Anthropic's native prefix caching.

## Production deployment: keep API keys out of `.env`

Local `docker compose up` injects `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
into Bifrost via the `environment:` block, which resolves from
`.env` in the compose project directory. **That's fine for development;
it's not fine for production** — the `.env` file lives on the host, is
read by every process in the compose network, and doesn't rotate.

For production deployments, inject Bifrost's provider keys from a real
secrets manager at container start. A few patterns:

### HashiCorp Vault (agent-injector or init container)

```yaml
services:
  bifrost:
    image: maximhq/bifrost:v2.2.1
    # Vault agent writes rendered env file to a tmpfs shared volume;
    # the container sources it before the main process starts.
    command: ["sh", "-c", ". /vault/secrets/bifrost.env && exec /app/main"]
    volumes:
      - vault-secrets:/vault/secrets:ro
```

### AWS Secrets Manager (ECS task definition)

Use ECS `secrets` (not `environment`) so the agent resolves the ARN at
task launch and injects the value as an env var that never hits the
task-definition JSON:

```json
"containerDefinitions": [
  {
    "name": "bifrost",
    "secrets": [
      {"name": "ANTHROPIC_API_KEY", "valueFrom": "arn:aws:secretsmanager:...:vigil/anthropic-api-key"},
      {"name": "OPENAI_API_KEY",    "valueFrom": "arn:aws:secretsmanager:...:vigil/openai-api-key"}
    ]
  }
]
```

### Kubernetes (Secret → envFrom)

```yaml
envFrom:
  - secretRef:
      name: vigil-llm-provider-keys
```

With the `Secret` populated via Sealed Secrets, External Secrets
Operator, or whatever mechanism you already use for other app secrets —
Bifrost doesn't care, it just wants the env var present at startup.

### What stays in `.env`

Non-secret Bifrost config (URL, log level, etc.) is fine to keep in
plaintext. The distinction is: if leaking the value to a host-mounted
`.env` file is acceptable, leave it in env; otherwise, route it
through your secrets manager of choice.

## Tool-use support matrix

| Provider | Basic chat | Tool calling | Streaming | Thinking / caching |
|---|---|---|---|---|
| Anthropic via Bifrost (`/v1` via LLMRouter; `/anthropic` via SDK client) | ✅ | ✅ | ✅ | `cache_control` traded away on the `/v1` path |
| OpenAI via Bifrost `/v1` | ✅ | ✅ | ✅ | n/a |
| Ollama via Bifrost `/v1` | ✅ | ⚠️ model-dependent (Llama 3.1+, Mistral) | ✅ | n/a |
{% endraw %}
