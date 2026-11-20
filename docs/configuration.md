---
layout: docs
title: "Configuration"
permalink: /docs/configuration/
---

{% raw %}
## Where do secrets live?

Vigil splits configuration into two stores:

1. **`.env`** — bootstrap-only settings the backend needs before the DB is
   reachable (URLs, ports, dev flags). Nothing sensitive belongs here.
2. **The encrypted secret store** at `~/.vigil/secrets.enc` — every API key,
   token, and password. Written by the web UI (Settings → AI models
   and Settings → Integrations) or by `set_secret()` programmatically. The
   master key sits next to it at `~/.vigil/master.key`.

LLM provider keys for the UI-configurable provider types (Anthropic,
OpenAI, Ollama, Vertex, OpenRouter) are managed entirely through
the UI — they land in the encrypted store and are pushed to Bifrost via its
admin API in the same request. Ollama is configured by URL and has no API
key. (Gemini is a Bifrost-seeded provider, not a configurable provider type.) See [STATE.md](/docs/state/) for the full secret
inventory.

## `.env`

Copy `env.example` to `.env`:

```bash
cp env.example .env
chmod 600 .env
```

### What goes in `.env`

| Variable | Description |
|----------|-------------|
| `DEV_MODE` | Bypass auth for local development |
| `DATABASE_URL` | PostgreSQL connection for the TypeScript agent (its knob; the Python backend does not consult it) |
| `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_DB` / `POSTGRES_USER` | Python backend PostgreSQL connection (defaults `localhost` / `5432` / `deeptempo_soc` / `deeptempo`; or the encrypted-store DSN) |
| `REDIS_URL` | ARQ job queue connection |
| `BIFROST_URL` | LLM gateway address (default `http://localhost:8080` on the host; `http://bifrost:8080` inside the compose network) |
| `BIND_HOST` / port numbers | Network binding |
| `SECRETS_BACKEND` | `encrypted` (default), `dotenv`, `env`, `keyring` — where new secrets are written |
| `ENABLE_KEYRING` | `false` (default), `true` — include OS keyring in read chain |
| `SENTRY_DSN` | Error reporting endpoint |

### What does NOT go in `.env`

- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — Settings → AI models (Ollama is configured by URL, not by an API key)
- `SPLUNK_PASSWORD`, `FALCON_CLIENT_SECRET`, `VIRUSTOTAL_API_KEY`, etc. — Settings → Integrations (`CROWDSTRIKE_CLIENT_SECRET` is the env-file name; the Settings UI stores the CrowdStrike client secret as `FALCON_CLIENT_SECRET`)
- Any password, token, or private key

A stale placeholder in a higher-priority source (such as the process
environment) can shadow the real value in a lower-priority one; once a value
is in the encrypted store, `.env` placeholders for it are ignored.

## Secrets read priority

When reading, backends are checked in order:
1. Encrypted file (`~/.vigil/secrets.enc`)
2. Process environment variables
3. Repo-root `.env` file (read-only)
4. State-dir `.env` file (legacy / interoperability)
5. OS keyring (only when explicitly enabled, `ENABLE_KEYRING=true`)

## Deployment Examples

### Local Development

```bash
./start.sh
```

### Docker Compose

The full stack (including postgres, redis, and bifrost) is defined in
`infra/docker/docker-compose.yml`:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Published images are under `ghcr.io/vigil-soc/`. Releases publish four
signed images: `ghcr.io/vigil-soc/vigil-backend`, `vigil-daemon`,
`vigil-agent` and `vigil-mcp-runner`. There is no
single-container `vigil` image; the backend requires the other services
in the Compose stack.

### Systemd

```ini
[Service]
EnvironmentFile=/opt/vigil/.env
ExecStart=/opt/vigil/venv/bin/uvicorn services.api.main:app --host 0.0.0.0 --port 6987
```

### Kubernetes

For server-side deployments, LLM provider keys can be injected as
environment variables at pod start (operator path — distinct from
the local-dev UI path). See [HELM.md](/docs/helm/) for the recommended
Helm chart values, including `secrets.anthropicApiKey`.

```bash
kubectl create secret generic vigil-secrets \
  --from-literal=DATABASE_URL="postgres://<user>:<password>@<host>:5432/<db>" \
  --from-literal=POSTGRES_HOST="<host>" \
  --from-literal=POSTGRES_PORT="5432" \
  --from-literal=POSTGRES_DB="<db>" \
  --from-literal=POSTGRES_USER="<user>" \
  --from-literal=POSTGRES_PASSWORD="<password>"
```

Note: `DATABASE_URL` is the TypeScript agent's knob. For the Python
backend, supply the `POSTGRES_*` settings (or the encrypted-store DSN)
instead, or use the Helm-secret path (see `secrets.anthropicApiKey`
above).

```yaml
envFrom:
  - secretRef:
      name: vigil-secrets
```

## UI Configuration

Most integrations are configured via **Settings > Integrations** in the web UI:

- API endpoints, usernames, non-sensitive config
- Passwords/secrets are written to the encrypted store by the UI; environment variables are only a read fallback
- Test connection before saving

## PostgreSQL Setup

Default connection (matches `infra/docker/docker-compose.yml`):

```
postgresql://deeptempo:deeptempo_secure_password_change_me@localhost:5432/deeptempo_soc
```

Start database:

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
```

## Security Best Practices

1. Never commit `.env` files to git
2. Use `chmod 600` on secret files
3. Rotate API keys periodically
4. Use separate secrets per environment (dev/staging/prod)
{% endraw %}
