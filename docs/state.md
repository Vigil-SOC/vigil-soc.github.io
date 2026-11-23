---
layout: docs
title: "State and Secrets"
permalink: /docs/state/
---

{% raw %}
This project grew with state scattered across several locations. This
doc is the canonical map: where each kind of thing lives, which store
is authoritative, and what's deprecated.

## Secrets

**Authoritative store: `~/.vigil/secrets.enc`** (Fernet-encrypted JSON,
chmod 600). The symmetric key lives at `~/.vigil/master.key` (chmod 600,
auto-generated on first write). Both files sit outside the repo, so
`.env` rewrites, `setup_dev.sh`, resetting the project dir, or git
checkouts don't nuke stored credentials.

**Backend priority** (read order in `SecretsManager.read_backends`):

1. `EncryptedFileBackend` — `~/.vigil/secrets.enc` (preferred)
2. `EnvironmentBackend` — `os.environ`
3. `DotEnvBackend` — repo-root `.env` (read-only; skipped under `VIGIL_DISABLE_DOTENV`)
4. `DotEnvBackend` — state-dir `.env` (`~/.vigil/.env`, with legacy `~/.deeptempo/.env` fallback)
5. `KeyringBackend` — OS keychain, only when explicitly enabled (via `ENABLE_KEYRING=true`, the `enable_keyring` key in `general_config.json`, or `SECRETS_BACKEND=keyring`)

**Default write backend:** `encrypted` when `cryptography` is
available, otherwise `dotenv` (override with
`SECRETS_BACKEND=env|dotenv|keyring`).

**Editing a secret.** Use the LLM Providers UI (Settings → AI models →
Providers) or the `set_secret()` helper from `core.secrets` /
`core.secrets_manager`.
Never write secrets into `.env` by hand; that file is for non-secret
bootstrap flags only (see below).

**Migrating legacy secrets.** Run once:

    python scripts/migrate_dotenv_secrets.py            # move keys from ~/.vigil/.env into the encrypted store, removing each from the dotenv file as it is migrated
    python scripts/migrate_dotenv_secrets.py --dry-run  # copy into secrets.enc but keep the dotenv copy (still writes to secrets.enc; not a preview)
    python scripts/migrate_dotenv_secrets.py --keys KEY [KEY ...]  # restrict to specific keys

**Backup.** Back up `~/.vigil/` as a unit — both files are needed.
Losing `master.key` means losing every secret in `secrets.enc`; there
is no recovery.

## Non-secret runtime config

**Authoritative store: Postgres `system_config` table.** Runtime-editable
settings (orchestrator tunables, AI operations, general/S3/Darktrace
settings, feature flags, etc.) live here with a full audit trail in
`config_audit_log`. Access via `services/api/routers/config.py` and the Settings UI.

New runtime config should go here — not into `.env`.

## `.env` (repo root)

**Purpose: bootstrap only.** Values needed to start the backend before
the DB is reachable. Nothing sensitive should live here.

Safe to put in `.env`:
- `DATABASE_URL`, `REDIS_URL`, `BIFROST_URL`
- `BIND_HOST`, port numbers
- `DEV_MODE`, `SECRETS_BACKEND`, `ENABLE_KEYRING`
- `SENTRY_DSN` (non-secret in practice)
- `LOG_LEVEL`, polling intervals, etc.

**Do not put in `.env`:** API keys, tokens, passwords. Store via the UI
or `set_secret()`; they land in `~/.vigil/secrets.enc`.

Historical `ANTHROPIC_API_KEY` placeholder lines in `.env` are ignored
when the encrypted store has a value.

## State-dir `.env` (`~/.vigil/.env`)

This is the default file for `DotEnvBackend`. `~/.deeptempo/.env` is
only a legacy *read* fallback for the same file; writes always target
the state directory (`~/.vigil/`). `scripts/migrate_dotenv_secrets.py`
moves values from the state-dir dotenv file into
`~/.vigil/secrets.enc`, removing each key from the dotenv file as it
is migrated (use `--dry-run` to keep the dotenv copy).

## `~/.vigil/general_config.json`

Kept for two flags: `enable_keyring` and `demo_mode` (read as a fallback when the demo_mode setting is unset). You can also set `enable_keyring` via the `ENABLE_KEYRING` env var in `.env`. This file is benign and will likely be folded into `system_config` in a future cleanup.

## Pointers (DB → secret store)

| Table | Points to |
|---|---|
| `llm_provider_configs.api_key_ref` | a key in the secrets manager (e.g. `llm_provider_anthropic-default_api_key`) |
| `integration_configs` | references secrets by name; values in secrets manager |

Row + value are decoupled on purpose: the DB is safe to back up / copy,
and secrets stay in the encrypted store at rest.

## Bifrost

Bifrost is a sidecar container that fronts all LLM traffic. It has its
own internal state for provider config and cache. Vigil does **not**
rely on Bifrost reading `env.ANTHROPIC_API_KEY` from its docker env
anymore — that was the old flow and caused the "key lost on restart"
problem. Instead:

- On backend startup, `core.llm.bifrost.admin.sync_all_provider_keys()`
  pushes every key in the secrets manager to Bifrost via its admin API.
  Keys are a subresource at `/api/providers/{name}/keys`, not on the
  `/api/providers/{name}` document: an existing key is updated with
  `PUT /api/providers/{name}/keys/{id}`, and a new key is created with
  `POST /api/providers/{name}/keys`.
- On provider create/update/delete in the UI, the corresponding endpoint
  in `services/api/routers/llm_providers.py` pushes the new (or empty) value to
  Bifrost in the same request.

So the flow is: **UI → secrets_manager → bifrost_admin → Bifrost** in
one synchronous chain. No container restart needed to rotate a key.

The seed `infra/docker/bifrost/config.json` references `env.*` only for
the admin password (`env.BIFROST_ADMIN_PASSWORD`) and the Ollama URL
(`env.OLLAMA_URL`); the hosted providers' `keys` arrays in the seed are
empty, and the actual key *values* are pushed at runtime.

## Workdirs and logs

- `data/investigations/` — orchestrator working files (investigation
  transcripts, context docs, agent output).
- `logs/*.log`, `logs/*.pid` — runtime logs and process pids (started
  via `start.sh`).

## Docker volumes

The core volumes are:

- `postgres_data` — Postgres data.
- `redis_data` — Redis (ARQ queue + rate limiting).
- `bifrost_data` — Bifrost's persistent state: its seeded-then-live
  config store and `logs.db` at `/app/data`.
- `prometheus_data` — Prometheus data.

The compose file declares 23 named volumes in total; the others include
`vigil_home`, `vigil_investigations`, `detection_rules`, `medic_data`,
`grafana_data`, `elastic_data`, `kafka_data`, `backup_repo` and
`upgrade_state`.

## Quick reference

| Thing | Where |
|---|---|
| API keys, tokens | `~/.vigil/secrets.enc` |
| Runtime settings (UI-editable) | Postgres `system_config` |
| Bootstrap flags (DB URL, ports, DEV_MODE) | repo `.env` |
| Ephemeral runtime | Redis, Postgres |
| Investigation files | `data/investigations/` |
| Logs, PIDs | `logs/` |
| Legacy secrets (migrate from) | `~/.deeptempo/.env` |
{% endraw %}
