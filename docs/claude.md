---
layout: docs
title: "AI Assistant Notes"
permalink: /docs/claude/
---

{% raw %}
This file provides guidance for AI assistants (Claude Code and similar tools) working in this repository.

---

## Project Overview

**Vigil** is an open-source, AI-native Security Operations Center (SOC) platform. It orchestrates specialized AI agents via Claude/Bifrost to perform triage, investigation, threat hunting, forensics, and automated response across extensible security integrations.

**Core pillars:**
- **Agents** — Specialized built-in agents identified by `AgentId` in
  `core/agents/builtins.py`, whose manifests live in `core/agents/manifests/`
  and are loaded by `builtin_manifests()` (including triage, investigator,
  threat_hunter, correlator, responder, reporter,
  mitre_analyst, forensics, threat_intel, compliance, malware_analyst,
  network_analyst, auto_responder).
- **Workflows** — Multi-agent orchestrated playbooks defined in
  `core/workflows/definitions/` (Cloud Incident, Forensic Analysis, Full
  Investigation, Incident Response, Root Cause Analysis, Shadow Adjudication,
  Threat Hunt). Most declare `run_kind: investigate` and walk their `phases:`
  in order; the others declare `run_kind: root_cause`, `run_kind: adjudicate`,
  or — for `threat-hunt` — `run_kind: hunt`, which runs the **hypothesis loop**
  instead — a Hunt Lead picks
  each move from what the evidence did to each belief, so its `phases:` block is
  a dispatch roster rather than an order.
- **Integrations** — Extensible MCP servers in `mcp-config.json` (Splunk, CrowdStrike, VirusTotal, Shodan, Jira, Slack, etc.). Count only dict-valued keys: the `mcpServers` object also holds `_comment_*` string keys used as section separators.

**Ports:**
- Backend API: `http://localhost:6987`
- Frontend: `http://localhost:6988`
- PostgreSQL: `5432`
- Redis: `6379`

---

## Repository Structure

```
vigil/
├── services/             # Deployables only — agent, api, daemon, mcp_runner, medic, medic_dockerproxy, medic_gateway, worker
│   ├── api/              # API composition root: main.py (app entry), discovery.py, middleware/, routers/ (parked routers)
│   ├── daemon/           # Autonomous 24/7 SOC background process
│   │   ├── main.py       # Daemon entry point (python services/daemon/main.py)
│   │   ├── orchestrator.py   # Main autonomous agent orchestrator
│   │   ├── poller.py         # Fetches alerts from SIEM/EDR
│   │   ├── processor.py      # Processes findings through AI pipeline
│   │   └── scheduler.py      # Cron-style scheduled tasks
│   └── worker/           # ARQ llm-worker, drains the arq:llm queue, started directly by
│                          # start.sh/compose/Helm (python -m services.worker), never supervised
├── clients/web/             # React + TypeScript + Vite SPA
│   └── src/              # screens/, shell/, shared/, services/, contexts/, config/, data/, extensions/, routing/, assets/, styles.css, App.tsx, main.tsx
├── tools/mcp/            # Vigil's own MCP server (vigil.py)
├── core/                 # Shared library: capability domains + a storage/platform tier; API routers colocate at core/<domain>/*_router.py
│   ├── llm/              # The LLM layer: router/, harness/, providers/, cost/
│   └── workflows/definitions/  # Workflow definitions as WORKFLOW.md files (cloud-incident, forensic-analysis, full-investigation, incident-response, root-cause-analysis, shadow-adjudication, threat-hunt)
├── data/                 # Schemas, MITRE taxonomy, detection registry
├── tests/                # pytest + vitest test suites
├── docs/                 # Detailed documentation
├── infra/                # Deploy machinery (was docker/ + helm/ + database/init/)
│   ├── docker/           # docker-compose.yml + Dockerfiles
│   ├── helm/             # Helm chart (vigil/)
│   └── database/init/    # PostgreSQL init SQL (docker-compose: lex order by filename; Helm: values.yaml dbInit.sqlFiles)
├── scripts/              # Init and utility shell scripts
├── mcp-config.json       # MCP server definitions (+ `_comment_*` separator keys)
└── env.example           # Template for environment variables (171 assignments at 1.1.4)
```

> **Layering:** `core/` is a library and must never import `services/`, and the
> shared-infrastructure tier (`core/storage`, `core/platform`) must never import a
> capability domain. `.importlinter` enforces both on every PR — `lint-imports`
> gates, alongside `flake8`, `black` and `isort`. Only `mypy` and the
> comment-style check are advisory. Run it locally with `lint-imports`.
>
> The only sanctioned `sys.path` entry is the repo root, added by
> `services/api/main.py` and `services/daemon/main.py` so `core.*` and `services.*`
> resolve however the process was launched. Never add `services/` itself: that
> makes `daemon`/`api`/`worker` importable as bare top-level names, giving the same
> file two module identities, and import-linter cannot see those edges.

---

## Development Setup

### Quick Start

```bash
git clone https://github.com/Vigil-SOC/vigil.git
cd vigil
./start.sh           # Starts PostgreSQL (Docker), backend, and frontend
```

### Manual Start

```bash
# 1. Start infrastructure
cd infra/docker && docker compose up -d postgres redis

# 2. Backend (from repo root)
source venv/bin/activate
uvicorn services.api.main:app --host 0.0.0.0 --port 6987 --reload

# 3. Frontend
cd clients/web && npm run dev

# 4. (Optional) Daemon
./start.sh --daemon
```

### Desktop (Electron)

```bash
cd clients/desktop && npm run dev    # builds TS, launches Electron
cd clients/desktop && npm run dist   # builds, prepares the standalone bundle, then packages via electron-builder
```

The desktop app drives the stack through `scripts/app_up.sh` / `app_down.sh`
rather than `start.sh`: no `--reload`, no Vite (the built SPA is served by the
backend at :6987), and it **forces `DEV_MODE=false`** because its login and
first-run bootstrap are the point.

### Fresh Environment

```bash
./setup_dev.sh   # Creates venv, installs all Python + npm deps
```

### The Python toolchain

Vigil **provisions** its interpreter rather than discovering one. `.python-version`
pins the version (3.12) and `scripts/lib.sh` uses `uv` to download a standalone
CPython matching it and the host's architecture — so conda, pyenv, or a system
Python on `PATH` cannot influence what the venv is built from. There is no
`find_python`; do not reintroduce `PATH` scanning.

Two details are load-bearing and easy to undo by accident:

- `--python-preference only-managed` is passed as a **flag** to `uv venv`.
  Without it uv reuses any same-version interpreter on `PATH`; as an env var it
  loses to a user who has `UV_PYTHON_PREFERENCE` set.
- A `uv` found on `PATH` is used only when its own target triple matches
  `uname -m`. An x86_64 uv provisions x86_64 interpreters even under
  `only-managed`.

The venv is disposable: one that doesn't match the pin is deleted and rebuilt
(~2s warm) rather than repaired. `install_python_deps` is fatal on failure and
ends by importing what the services need, so breakage reports at its cause.

Dependencies install from **`requirements.lock`** (fully pinned, `--universal`
so one file covers macOS/Linux and arm64/x86_64). `requirements.txt` remains the
list of direct dependencies with acceptable ranges. After changing it, run
`./scripts/update_lock.sh` and commit both. CI and both Docker images install
from the lock too.

### Prerequisites

- **Python 3.12** — provisioned automatically by `uv` (see `.python-version`); no host Python needed
- **Node.js 20+** (CI pins 20; the shipped images use Node 22)
- **Docker Desktop** (must be running — used for PostgreSQL and Redis)
- **Git**

### Environment Variables

Copy `env.example` to `.env` and populate as needed. `.env` is for
bootstrap-only settings (DB URL, ports, dev flags). LLM provider keys,
integration credentials, and other secrets are configured in the web UI
(Settings → AI models, Settings → Integrations) and stored
encrypted at `~/.vigil/secrets.enc` — see [docs/STATE.md](/docs/state/).

| Variable | Purpose | Default |
|----------|---------|---------|
| `DEV_MODE` | Bypass all authentication | `false` when unset; `env.example` ships `false` |
| `DATABASE_URL` | PostgreSQL connection | auto-set by docker-compose |
| `REDIS_URL` | ARQ job queue | `redis://localhost:6379/0` |
| `BIFROST_URL` | LLM gateway address | `http://localhost:8080` in code (`http://bifrost:8080` is the compose-internal value) |
| `SECRETS_BACKEND` | Where new secrets are written | `encrypted` |

> ⚠️ Do **not** put `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, Splunk
> credentials, etc. in `.env`. Use the UI. Placeholder values in `.env`
> are ignored when the encrypted store has a value.

### Reading configuration

Config flows through exactly three channels. Do not add `os.getenv` calls —
`tests/unit/_ratchets/test_no_ambient_state.py` fails CI on them.

| Need | Use | Owner |
|------|-----|-------|
| Non-secret setting | `core.config.get_settings().field` | env / `.env` |
| Credential | `core.secrets.get_secret("NAME")` | `~/.vigil/secrets.enc`, then env |
| UI-editable at runtime | `core.platform.runtime_config` / `core.storage.config_service` | `system_config` table |

`core/config.py` is the single definition site: every setting is a typed field
with its default, and `tests/unit/_ratchets/test_settings_env_example.py` fails if a field
is missing from `env.example` or vice versa. `get_settings()` is `lru_cache`d, so
a test that changes env mid-test must call `get_settings.cache_clear()`.

Config file paths go through `core.config.vigil_path()`, which reads from
`~/.vigil` with a fallback to the legacy `~/.deeptempo` copy and always writes to
`~/.vigil`. Pass `write=True` on save paths.

The two legitimate exceptions, both marked `# noqa: ENV001`: exporting env into
spawned MCP child processes (env is their config protocol, so third-party servers
need no adaptation), and genuinely dynamic variable names.

---

## Running Tests

### Python (pytest)

The pytest config lives at **`tests/pytest.ini`** — there is no root-level
`pytest.ini`. (`setup.cfg` carries other tool config, including coverage.py
settings that must stay in step with `tests/pytest.ini`.) A bare `pytest` from the repo
root therefore finds no ini file: markers go unregistered, `--asyncio-mode=auto`
and the coverage flags are skipped, and collection starts from the CWD instead of
`testpaths = tests`. Always scope to `tests/` (or pass `-c tests/pytest.ini`).

```bash
# All tests, with the intended config
pytest tests/

# By marker
pytest tests/ -m unit
pytest tests/ -m integration   # requires running PostgreSQL
pytest tests/ -m "not external_service"   # what CI's main unit job runs

# Single test file (pass a real path under tests/)
pytest tests/ -v -k <test-name>
```

Available markers: `unit`, `integration`, `slow`, `auth`, `siem`, `claude`,
`database`, `api`, `daemon`, `performance`, `external_service`.
`--strict-markers` is on, so an unregistered marker is an error — add new ones to
`tests/pytest.ini`.

### Frontend (vitest)

```bash
cd clients/web
npm run test           # watch mode
npm run test:run       # single run with verbose output
npm run test:coverage  # with coverage report
npm run test:ci        # CI mode (JSON output)
```

### Linting

`flake8`, `black` and `isort` **gate CI** over `services/` and `core/`. Pass no
arguments: `setup.cfg` holds the flake8/isort config, and it is the same file pre-commit
reads, so formatting locally cannot produce a tree CI rejects. `mypy` stays
advisory.

`./setup_dev.sh` installs the pinned toolchain and the pre-commit hook. To add it
to an existing venv:

```bash
pip install -r requirements-dev.txt && pre-commit install
```

```bash
# Python — the three that gate, scoped as CI scopes them
black services/ core/
isort services/ core/
flake8 services/ core/
mypy services/ core/ --ignore-missing-imports   # advisory

# TypeScript
cd clients/web && npm run lint

# All three at once, on what you changed
pre-commit run --all-files
```

`tests/`, `tools/` and `scripts/` are not gated and have not been cleaned;
pre-commit is scoped to match, so a one-line change there does not arrive
carrying hundreds. Bumping a pin means committing the reformatting it causes,
in `requirements-dev.txt` and `.pre-commit-config.yaml` together.

---

## Key Architecture Patterns

### Async-First Backend

All FastAPI endpoints and service methods use `async/await`. Long-running LLM operations go through the ARQ Redis queue (worker pattern). Never add blocking I/O to endpoint handlers.

**The DB layer is synchronous SQLAlchemy — there is no `AsyncSession` in this
repo.** `core/storage/connection.py` exposes a `sessionmaker` and helpers
`get_db_manager()`, `get_db_session()` and `get_session()` yielding a plain
`Session`. So don't type a dependency as
`AsyncSession` or `await` a session call. Handlers that are fully synchronous can
be plain `def` (FastAPI runs those in a threadpool); handlers that must stay
`async` should push sync DB calls through `asyncio.to_thread` rather than
blocking the loop.

### LLM Traffic Routes Through Bifrost

All LLM calls — including Anthropic — go through the **Bifrost** gateway
(`BIFROST_URL`, code default `http://localhost:8080`), which layers on caching,
centralized cost tracking, and budget enforcement.

- **Never instantiate `Anthropic()` directly.** Import
  `create_anthropic_client` / `create_async_anthropic_client` from
  `core/llm/providers/clients.py` — the single source of truth for client
  construction. The one exception is key-validation endpoints that must hit the
  real upstream to verify a user-supplied credential.
- Dispatch and retry live under `core/llm/router/` and
  `core/llm/gateway_retry.py`; `BudgetExceeded` is defined in
  `core/llm/cost/budget.py`.
- Provider API keys are **not** in `.env` — they live in the encrypted secrets
  store and are configured via the UI.

### Service Layer

Business logic lives in `services/`, not in API route handlers. A router lives with its domain as `core/<domain>/<name>_router.py` (or, until that domain is in `core/`, parked in `services/api/routers/`) and delegates to service classes. When adding a feature:
1. Add logic to an existing service or create `services/your_feature_service.py`
2. Add the router module (a `router` **and** a `ROUTER_META`) under `core/<domain>/` or `services/api/routers/`
3. Nothing to register — `services/api/discovery.py` scans both locations and mounts it at startup (issues #478, #488)

### MCP Tool Access

Agents access external tools through the MCP protocol. Tool definitions live in `mcp-config.json`, which spawns each in-repo server as its own `python3` subprocess. A vendor's server lives in that vendor's slice as `core/integrations/<vendor>/tool.py` (see the [vendor slices](/docs/vendor-slices/) page for the inventory and the outbound-HTTP conventions); `tools/mcp/` holds Vigil's own MCP server (`vigil.py`), which talks to Vigil's own services; the rest of the entries are external servers.

### Database

- PostgreSQL 16 via SQLAlchemy ORM — models in the `core/storage/models/`
  package, sessions via `get_db_manager()` / `get_db_session()` / `get_session()`
  in `core/storage/connection.py`
- Schema initialized by `infra/database/init/` SQL files. **Execution order
  differs by deploy path:** docker-compose mounts the directory at
  `/docker-entrypoint-initdb.d`, where Postgres runs files in
  **lexicographic filename order** (the `01_`/`04_`/…/`16_` prefixes
  are authoritative there). The Helm chart, by contrast, iterates
  `infra/helm/vigil/values.yaml`'s `dbInit.sqlFiles` list in the **order
  written there** — prefixes are decorative for the chart path
- pgvector extension for embeddings
- Use `core/storage/database_data_service.py` for data access — do not query the DB directly from API handlers
- **`infra/database/init/` is not the whole schema.** `cases`, `findings`,
  `case_evidence`, `case_tasks`, `case_watchers` and `investigations` have no
  `CREATE TABLE` there — `create_all` at startup is the only thing that builds
  them, so an `ALTER TABLE` in a numbered init file for one of them hard-fails
  (the dbInit Job runs before the app ever starts). `users`/`roles` and
  `skills`/`custom_agents`/`workflow_runs`/`custom_workflows` *are* covered.
  Grepping for a table name is misleading — `cases` and `findings` appear in
  9–10 init files, but every hit is a string literal, not DDL
- **Adding a column to one of those ORM-only tables does not reach existing
  databases.** `create_all` is `checkfirst=True` — it creates missing tables and
  never alters existing ones. `check_schema_drift()` in
  `core/storage/connection.py` reports the gap at ERROR and publishes the state
  under `schema` in `/api/health`; `DB_STRICT_SCHEMA=true` makes it fatal.
  Reporting is not fixing. The check
  compares column *names*, so a changed type or a new `NOT NULL` is drift it
  cannot see

**When adding or modifying an init SQL file under `infra/database/init/`:** the
chart bundles a *copy* under `infra/helm/vigil/files/database-init/` (Helm can
only read files inside the chart directory). You must (1) copy the file
into the chart bundle, (2) add it to `infra/helm/vigil/values.yaml`
`dbInit.sqlFiles` in the correct execution order, and (3) verify with
`helm template ... | grep -E '^[[:space:]]*apply "NEWFILE\.sql"'` that
the dbInit Job script applies it (a bare `grep NEWFILE.sql` false-matches
the ConfigMap key and the SQL header comment). CI catches step 1
(`Helm Chart / Lint and Template` runs `diff -r` between the two
directories). Skipping step 2 is silent (the file is in the ConfigMap
but never applied); skipping step 1 while keeping the file in
`dbInit.sqlFiles` makes the Job hard-fail at runtime — *unless* the
filename already has a row in `_vigil_schema_versions`, in which case
it SKIPs as already-applied (the marker-table check runs before the
file-existence check, so legacy `003_*` ghost rows on v0.1.x upgrades
don't break `helm upgrade --reuse-values`). See
[`infra/database/init/README.md`](/docs/database-init/), which also lists
two filenames that are reserved and must never be reused.

### Authentication

- `DEV_MODE=true` bypasses all auth — use for local development
- **Unset means `false`.** The default lives in one place since #520 —
  `dev_mode: bool = False` in `core/config.py` — so anywhere without a `.env`
  (CI, containers, production) enforces auth. `env.example` also ships
  `DEV_MODE=false`. Tests that lean on a developer's
  `.env` — e.g. for `JWT_SECRET_KEY`, which is required once `DEV_MODE` is off —
  will fail in CI; set what you need explicitly
- Production auth lives in `core/auth/` (e.g. `auth_service.py`,
  `auth_cookies.py`, `current_user.py`)
- RBAC tables are defined in `infra/database/init/06_auth_tables.sql`

### Daemon / Autonomous Mode

The daemon (`services/daemon/`) runs as a separate process with its own orchestration loop (`python services/daemon/main.py`). It polls for new alerts, processes them through the AI pipeline, and can execute automated responses.

`env.example` lists `DAEMON_AUTO_TRIAGE`, `DAEMON_CONFIDENCE_THRESHOLD`, `ORCHESTRATOR_MAX_COST` and `ORCHESTRATOR_MAX_HOURLY_COST`; these map onto typed fields in `core/config.py` (`daemon_auto_triage`, `daemon_confidence_threshold` and the other daemon thresholds, `orchestrator_max_cost`, `orchestrator_max_hourly_cost` and the other orchestrator limits), and Settings is case-insensitive, so they are settings defined through the config channel described above.

---

## Code Conventions

### Python

- **Formatter**: Black, line length **88** (its default; pinned in `requirements-dev.txt`)
- **Linter**: Flake8 — gates CI. `E501` is off because black owns wrapping, so
  the only long lines left are strings black cannot split
- **Imports**: isort
- **Type hints**: mypy (ignore-missing-imports mode)
- **Async**: prefer `async def` for all service methods and route handlers
- File naming: `snake_case.py`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

### TypeScript / React

- **Framework**: React 19 + Vite 8 (not CRA)
- **UI**: Tailwind utility classes + the CSS custom properties in
  `clients/web/src/styles.css`. Reuse the primitives in
  `src/shared/` (`ui.tsx`, `formKit.tsx`, `icons.tsx`) — there is no
  component library, so do not add one
- **State/data**: plain hooks (`useState`/`useEffect`) over the axios services;
  React Context for auth/theme/toasts
- **HTTP**: axios via `clients/web/src/services/`
- **Linter**: ESLint with `@typescript-eslint/recommended` + `react-hooks/recommended`
- Component files: `PascalCase.tsx`
- Service files: `camelCase.ts`
- Test files collocated: `Component.test.tsx`

### Commit Messages

- Required: DCO sign-off (`git commit -s`)
- Format: short summary line (≤50 chars) + optional body (wrap at 72)
- One logical change per commit
- Example: `git commit -s -m "Add SentinelOne MCP integration"`

### API Routes

Follow the existing pattern:
```python
# core/<domain>/your_feature_router.py   (or services/api/routers/your_feature.py)
from core.storage.connection import get_db_session
from core.routing import Auth, RouterMeta

router = APIRouter()   # prefix/tags live in ROUTER_META, not here
ROUTER_META = RouterMeta(prefix="/api/your-feature", tags=["your-feature"], auth=Auth.REQUIRED)

@router.get("/")
async def list_items():
    db = get_db_session()   # sync Session — do not await it
    return your_feature_service.list(db)
```
No registration step — discovery mounts every module that exports a `router` and a `ROUTER_META`.

---

## Adding New Features

### New MCP Integration

1. Implement the MCP server as `core/integrations/<vendor>/tool.py` (or `tools/mcp/` for one that talks to Vigil's own services)
2. Add the server definition to `mcp-config.json`
3. Document in the site's integrations documentation

### New Agent

1. Add the agent record in `core/agents/builtins.py` (prompt text lives in `core/agents/prompts.py`)
2. Wire agent invocation in the agent layer (`core/agents/`, `services/agent/`) — not in `core/llm/harness/claude.py`, which is the one-shot completion service with no tools and no loop
3. Expose via `services/api/routers/agents.py`
4. Document in the site's agents documentation

### New Workflow

1. Create `core/workflows/definitions/your-workflow/WORKFLOW.md` following existing format
2. Define agent sequence, tools, and phase instructions
3. Register in workflow service if needed

For a hypothesis-driven hunt instead of a phase chain, declare `run_kind: hunt`
and state `hypotheses` (required — a hunt with nothing to test is refused),
`attack_techniques` and `data_domains`. `playbook_resolver.resolve_hunt()`
resolves the hunt against whatever tools the deployment carries, dropping any
it has none for.

### New API Endpoint

1. Add the router module (with `router` + `ROUTER_META`) under `core/<domain>/` or `services/api/routers/`
2. Add service logic in `services/`
3. Add Pydantic schema alongside the domain (e.g. `core/skills/schemas.py`) if needed
4. No registration — discovery mounts it automatically
5. Add corresponding frontend API call in `clients/web/src/services/`

---

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci-cd.yml` | Push/PR to main, `release/**` | Lint → Unit Tests → Integration Tests → Security Scan → Docker Build |
| `release-please.yml` | Push to `main` and `release/**`, manual | Maintains a standing release PR with bumped `VERSION` / `Chart.yaml` (`appVersion` + `version`, lockstep) / `clients/web/package.json` / `clients/web/package-lock.json` + `CHANGELOG.md`. Minors and majors are cut by hand from `main` by merging its release PR (manual dispatch offers minor/major only); fix releases come from the single `release/X.Y.x` branch, whose pushes force a patch bump. On merge, push `vX.Y.Z` tag and create the GitHub Release. See `RELEASING.md`. |
| `release.yml` | Version tags (`v*.*.*`) | Build & push `vigil-backend` + `vigil-daemon` images to GHCR → Trivy scan → smoke-test that they start → annotate the GitHub Release with image digests. **Publishes images only — it does not deploy.** Does **not** create the GitHub Release object either (release-please owns that). |
| `helm-chart.yml` | Push/PR touching `infra/helm/**`, `infra/database/init/**`, or the workflow file itself (branches main, `release/**`) | Verify `database/init/` ↔ chart-bundle copies are in sync (`diff -r`) → `helm lint`/`template` across default, dev, and Bitnami-subchart values → kubeconform → `ct lint` |
| `nightly.yml` | Daily 2 AM UTC | Comprehensive security & performance audits |

The table above lists the principal workflows; `.github/workflows/`
holds 21 workflow files at 1.1.4, also including `backport.yml`,
`beta.yml`, `beta-cleanup.yml`, `build-images.yml`,
`connectors-live.yml`, `erasure-nightly.yml`, the `medic*.yml` family,
`release-branch.yml`, `release-guard.yml` and `scale-weekly.yml`.

CI runs:
- `black --check` + `flake8` + `isort --check` + `mypy` (Python)
- `eslint` (TypeScript)
- `hadolint` (Dockerfiles)
- `pytest --cov` (backend unit + integration)
- `vitest run` (frontend)
- `bandit -r core/ services/ tools/ scripts/ -ll -ii` + `npm audit --omit=dev --audit-level=high` (security)

The gating CI checks must pass before merging; some steps in `ci-cd.yml`
are advisory (`continue-on-error: true`, e.g. mypy), as noted in the Linting
section above.

---

## Important Files

| File | Purpose |
|------|---------|
| `services/api/main.py` | FastAPI app entry, middleware wiring, startup/shutdown |
| `services/api/discovery.py` | Router auto-discovery — scans `core/**/*_router.py` + `services/api/routers/` |
| `core/routing.py` | `Auth` + `RouterMeta` — the declarative mount metadata every router exports |
| `core/llm/harness/claude.py` | One-shot Anthropic completions (`ClaudeService`) — no tools, no loop |
| `services/worker/jobs.py` | ARQ llm-worker jobs — the `arq:llm` queue consumer (`python -m services.worker`) |
| `core/agents/` | Agent records (`builtins.py`), prompt assembly (`prompts.py`), runtime manager (`manager.py`) |
| `infra/database/init/` | Schema SQL — see Database section for the add/modify checklist |
| `mcp-config.json` | All MCP server definitions |
| `.python-version` | The pinned interpreter — venv, both Docker images, and CI |
| `requirements.lock` | Fully pinned dependency tree; what actually gets installed |
| `requirements-dev.txt` | Pinned lint/type toolchain; the three that gate CI |
| `setup.cfg` | flake8 + isort config — CI and pre-commit both read it |
| `env.example` | Every supported environment variable |
| `infra/docker/docker-compose.yml` | Full local stack definition |

---

## Submodules

The repo has no Git submodules at 1.1.4 (there is no `.gitmodules` file).

Historically, `deeptempo-core` and `mcp-servers` were submodules until they
were dropped: the former had **no production importer** in this repo, and the
latter's servers are vendored at `tools/mcp/`.

---

## Security Notes

- Never commit secrets or API keys — use `.env` (gitignored)
- `DEV_MODE=true` disables all auth — **never enable in production**
- Default PostgreSQL password in `docker-compose.yml` must be changed for production
- Bandit runs in CI to catch common Python security issues
- MCP tool calls that perform actions (host isolation, firewall rules) require approval workflow by default — see `core/response/approval_service.py`
{% endraw %}
