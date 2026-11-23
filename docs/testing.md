---
layout: docs
title: "Testing Guide"
permalink: /docs/testing/
---

{% raw %}
Guide to the test suites that exist in the Vigil repository at 1.1.4.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Substituting Services](#substituting-services)
- [Coverage](#coverage)
- [Best Practices](#best-practices)

---

## Overview

There is no `tests/unit/` or `tests/integration/` tree in the repository, and
the web UI has no test suite. The suites that exist are all under `tests/`
and are mostly live or evaluation suites that exercise a real stack:

- **Live connector tests** (`tests/live/`): each connector run against a real
  instance. Opt-in — the tree is skipped unless `VIGIL_LIVE_CONNECTORS=1`.
- **Medic Compose tests** (`tests/medic_compose/`): live tests of the Medic
  Compose stack (start path, enable, key groups, last-seen, full compose).
- **Medic evaluation tests** (`tests/medic_eval/`): fault-injection and
  evaluation cells, including the `tests/medic_eval/inject/` cell suites,
  run against a Compose evaluation stack.
- **Scale tests** (`tests/scale/`): a weekly run (`run.py`, `stack.py`,
  `compose.scale.yml`) that measures four limits of one install — open
  findings with the console still responsive, open cases at once,
  `/api/v1` requests per second, and alerts per minute at intake —
  against a real Compose stack.

The agent service (`services/agent/`) keeps test fixtures and replay data
under `services/agent/tests/` (fixtures and support files, not a separate
documented runner on this page).

There is no end-to-end suite for the web UI. The scale suite above is
the performance measurement in `tests/`; it is a weekly trend run with
no targets, not a pull-request gate.

### Test Frameworks

**Backend**: pytest, configured by `tests/pytest.ini`, with the shared
fixtures in `tests/conftest.py`.
**Frontend**: `clients/web` has no test framework, no test scripts and no
test files at 1.1.4 — its `package.json` scripts are only `dev`, `build`,
`lint`, `preview` and `generate:api`.

---

## Test Infrastructure

### Backend Setup

```bash
# Install dependencies
pip install -r requirements.txt

# The test dependencies in requirements.txt are:
# - pytest (test framework)
# - pytest-asyncio (async test support)
# - pytest-cov (coverage reporting)
```

No other test libraries are installed by `requirements.txt`. In particular
there is no `pytest-xdist`, `pytest-mock`, `pytest-timeout`, `faker`,
`freezegun` or `responses` — commands and examples that need them do not
work against this repository.

### Frontend Setup

```bash
cd clients/web
npm install
npm run build   # type-check and build; there is no test command
```

---

## Running Tests

### Backend Tests

```bash
# Run everything pytest collects under tests/
# (the live trees skip themselves unless their opt-in is set — see below)
pytest

# Run with coverage (the form tests/pytest.ini already applies)
pytest --cov=services --cov=core --cov-report=html

# Run a specific real test file
pytest tests/live/test_search_backends.py --no-cov

# Run a specific test
pytest tests/medic_compose/test_compose_live.py -k "<test name>"

# Run tests matching a name pattern
pytest -k "search"

# Run with verbose output
pytest -v
```

There is no `tests/run-tests.sh` script and no parallel `-n auto` mode:
`pytest-xdist` is not installed.

### Live Connector Tests

The live connector suite is opt-in. A probe whose credentials are absent is
skipped as not configured rather than failed. Run a group the way its CI
workflow does, for example the search-backends group:

```bash
LIVE_ENV_FILE=/tmp/live.env bash tests/live/ci/search_backends.sh up
set -a; . /tmp/live.env; set +a
VIGIL_LIVE_CONNECTORS=1 pytest tests/live/test_search_backends.py --no-cov
bash tests/live/ci/search_backends.sh down
```

See `tests/live/ACCOUNTS.md` for the accounts the probes expect.

### Medic Tests

The Medic Compose tests are live Compose tests. CI runs a single file with
the repository conftest and default addopts disabled, because
`tests/conftest.py` imports the backend's settings:

```bash
python -m pytest --noconftest -o addopts= -p no:cacheprovider -rs \
  tests/medic_compose/test_compose_live.py
```

The Medic evaluation cells under `tests/medic_eval/inject/` are also
opt-in; for example the stub cells require a live evaluation stack:

```bash
VIGIL_MEDIC_EVAL_LIVE=1 python -m pytest tests/medic_eval/inject/test_stub_cells.py
```

---

## Writing Tests

### Where tests live

Add a test to the suite it belongs to:

| Suite | Directory | Character |
|---|---|---|
| Live connector checks | `tests/live/` | One probe per connector, against a real instance; skipped without `VIGIL_LIVE_CONNECTORS=1` |
| Medic Compose | `tests/medic_compose/` | Live Compose stack tests (`test_compose_live.py`, `test_enable_live.py`, `test_key_group_live.py`, `test_last_seen_live.py`, `test_start_path_live.py`) |
| Medic evaluation | `tests/medic_eval/` and `tests/medic_eval/inject/` | Evaluation and fault-injection cells (`test_config_cells.py`, `test_helm_config_cells.py`, `test_host_native_cells.py`, `test_pipeline_cells.py`, `test_stub_cells.py`, `test_survival_checks.py`) |
| Scale | `tests/scale/` | Weekly measurement of four install limits against a real Compose stack (`run.py`, `stack.py`, `compose.scale.yml`); run by `scale-weekly.yml` |

Real files in those directories are the working examples for each suite —
start from the closest existing test rather than from a template.

### Shared fixtures

`tests/conftest.py` does not provide per-test data fixtures. It pins the
environment the suite runs under (authentication on, a test JWT secret,
CSRF in report-only mode) and defines four autouse fixtures that run for
every test:

- `_reset_settings_cache` — clears the cached `Settings` around each test
  and ignores the developer's `.env`.
- `_no_ambient_postgres` — points any accidental database connection at a
  host that cannot resolve, so a test cannot silently reach a developer's
  own running stack.
- `_reset_llm_path_cache` — drops the cached LLM path-health snapshot so
  one test cannot answer the next.
- `_bound_to_a_run` — binds a run principal for tool calls, except in tests
  marked `unbound`.

There is no `tests/fixtures/` directory and no shared `test_db_session`,
`sample_user`, `auth_headers` or `test_client` fixture.

---

## Coverage

Coverage is configured, but no threshold is enforced.

- `tests/pytest.ini` addopts include `--cov=services --cov=core` with
  `--cov-fail-under=0`, plus HTML, XML and term-missing reports.
- The coverage source in `setup.cfg` (`[coverage:run]`) is `services,core`.
- No CI workflow sets a coverage fail-under threshold.

```bash
# Generate an HTML coverage report
pytest --cov --cov-report=html
open htmlcov/index.html

# Generate XML coverage for CI
pytest --cov --cov-report=xml

# Show missing lines
pytest --cov --cov-report=term-missing
```

Do not treat any percentage as a repository gate; none is configured.

---

## Test Markers

`tests/pytest.ini` registers only these markers, and addopts include
`--strict-markers`, so any other marker fails:

| Marker | Meaning (as registered in `tests/pytest.ini`) |
|---|---|
| `unit` | Unit tests (fast, isolated) |
| `unbound` | Calls a tool with no principal bound |
| `integration` | Integration tests (slower, requires services) |
| `database` | Database tests |
| `external_service` | Tests that require an external service to be running |

```python
@pytest.mark.integration
def test_integration():
    pass
```

Run tests by marker:

```bash
# Only tests marked unit
pytest -m unit

# Only integration tests
pytest -m integration
```

There are no registered `slow`, `performance` or `timeout` markers.

---

## Substituting Services

Services are constructed once by whoever owns the process and injected from
there. Nothing reaches for a module-global accessor, so a test never has to
monkeypatch one — it supplies its own instance. Three rules:

| Where | How the service arrives |
|---|---|
| `services/api/main.py` lifespan | Constructs each service onto `app.state` (`_build_services`) |
| FastAPI handlers | A `Depends` provider from `core/deps.py` reads `request.app.state.<key>` |
| Everything else (services, daemon, LLM harnesses) | A constructor keyword argument, defaulting to a locally-built instance |

### Overriding a service in an API test

Use `app.dependency_overrides`, keyed on the provider function itself. The
handler then talks to your stub and touches no database, LLM, or MCP process.

```python
from core.api.v1.approvals_router import router as approvals_router
from core.deps import provide_approvals


class StubApprovals:
    def list_pending_approvals(self):
        return []


def test_pending_is_empty():
    app = FastAPI()
    app.include_router(approvals_router)
    app.dependency_overrides[provide_approvals] = lambda: StubApprovals()

    resp = TestClient(app).get("/api/v1/approvals/pending")
    assert resp.json() == {"actions": []}
```

The approvals router's prefix is `/api/v1` (with `/api` as a legacy prefix),
and its pending route returns `{"actions": [...]}`.

A bare `FastAPI()` like the one above runs no lifespan, so `app.state` holds
nothing — the override *is* the wiring. If you instead build a `TestClient`
over the real app as a context manager (`with TestClient(app) as c:`), the
lifespan does run and populates `app.state`; overrides still win.

### Overriding elsewhere

Outside a request there is no `Depends`, so pass the instance in — using the
constructors as they actually are at 1.1.4:

```python
# core/workflows/workflows_service.py: __init__(workflows_dir=None,
#   custom_workflows=None, workflow_runs=None) — there is no approvals argument.
svc = WorkflowsService(workflow_runs=WorkflowRunService())

# core/llm/harness/claude.py: __init__(provider_api_key_ref=None) only.
claude = ClaudeService()
```

### The one exception: MCPClient

`MCPClient` owns persistent stdio child processes that only its creator closes,
so exactly one may exist per process. The owner installs it
(`set_process_mcp_client` in `core/integrations/mcp/client.py`) and
`process_mcp_client()` returns it.

"One per process, installed by the owner" only holds if the processes are
enumerated. There are three, and two of them own a client:

| Process | Owns an MCPClient? |
|---|---|
| API (`services/api/main.py` lifespan) | yes |
| Daemon (`services/daemon/main.py` `_init_components`) | yes |
| ARQ llm-worker (`python -m services.worker`) | **no** — it constructs `ClaudeService()` directly in `services/worker/jobs.py` and installs no process MCP client |

Before any owner starts — which is the case in a plain test — it returns
`None`, so importing the harness never spawns child processes. To supply a fake, override `provide_mcp_client`; only reach for `set_process_mcp_client` when the code under test resolves the process slot directly.

---

## Mocking External Services

Prefer substitution over patching: hand the code under test a stub service
through a dependency override or a constructor argument, as above.

Where a stub cannot be injected, patch with the standard library's
`unittest.mock` at the place the name is looked up, and patch a method that
exists. For example, `ClaudeService` (`core/llm/harness/claude.py`) exposes
`chat(...)`; there is no `enrich_finding` method and no
`core.llm.harness.claude.anthropic` submodule to patch.

There is no installed HTTP-mocking library (`responses` is not a
dependency), so do not write examples that depend on one.

---

## Best Practices

### 1. Test Naming

```python
# Good
def test_create_case_with_valid_data():
    pass

def test_create_case_with_missing_title_returns_400():
    pass

# Bad
def test1():
    pass

def test_case():
    pass
```

### 2. Arrange-Act-Assert Pattern

```python
def test_calculate_priority():
    # Arrange
    finding = {"severity": "high", "confidence": 0.9}
    
    # Act
    priority = calculate_priority(finding)
    
    # Assert
    assert priority == "high"
```

### 3. One Assertion Per Test (when possible)

```python
# Good
def test_user_has_correct_username():
    user = create_user("testuser")
    assert user.username == "testuser"

def test_user_has_correct_email():
    user = create_user("testuser", "test@example.com")
    assert user.email == "test@example.com"

# Acceptable when testing related properties
def test_user_properties():
    user = create_user("testuser", "test@example.com")
    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.is_active is True
```

### 4. Avoid Test Interdependence

```python
# Bad - tests depend on order
class TestCases:
    case_id = None
    
    def test_create_case(self):
        self.case_id = create_case()
    
    def test_update_case(self):
        update_case(self.case_id)  # Fails if create_case didn't run

# Good - independent tests, each arranging its own data
class TestCases:
    def test_create_case(self):
        case_id = create_case()
        assert case_id is not None
    
    def test_update_case(self):
        case = create_case()
        result = update_case(case.id)
        assert result is True
```

### 5. Use Factories for Test Data

Build test data with a plain factory function and explicit defaults; do
not depend on a data-generation library, as none is installed.

```python
def create_test_user(**kwargs):
    """Factory for creating test users."""
    defaults = {
        "username": "testuser",
        "email": "testuser@example.com",
        "password": "test-password"
    }
    defaults.update(kwargs)
    return User(**defaults)

# Usage
def test_user_creation():
    user = create_test_user(username="specific_name")
    assert user.username == "specific_name"
```

---

## Debugging Tests

### Running in Debug Mode

```bash
# Run with print statements visible
pytest -s

# Stop on first failure
pytest -x

# Drop into debugger on failure
pytest --pdb

# Run last failed tests
pytest --lf
```

### Using pdb

```python
def test_complex_logic():
    import pdb; pdb.set_trace()
    
    result = complex_function()
    assert result == expected
```

---

## CI/CD Integration

Test execution in GitHub Actions at 1.1.4 is split by suite, not run as a
single unit-plus-integration job:

- `.github/workflows/ci-cd.yml` runs lint, generated-types, Docker,
  agent-image, setup-matrix and Helm checks — it contains no pytest test job.
- `.github/workflows/connectors-live.yml` runs the live connector suite,
  e.g. `pytest tests/live/test_search_backends.py --no-cov`,
  `pytest tests/live/test_local.py --no-cov` and
  `pytest tests/live/test_free_tier.py --no-cov`.
- `.github/workflows/medic.yml` and `.github/workflows/medic-nightly.yml`
  run the Medic Compose tests under `tests/medic_compose/`.
- `.github/workflows/nightly.yml` is a security audit only (`pip-audit`)
  plus a Slack notification; it runs no test suite and no performance tests.
- `.github/workflows/scale-weekly.yml` runs the scale suite
  (`tests/scale/`) weekly, on Mondays at 08:00 UTC.
- `.github/workflows/erasure-nightly.yml` runs the parallel-erasure check
  daily at 05:00 UTC.

See the [CI/CD guide](/docs/ci-cd/) for details.

---

## Troubleshooting

### Common Issues

**Issue**: Import errors for application modules
**Solution**: The code lives in `core/` and `services/` — there is no
`backend` package. Run pytest from the project root so those packages are
importable.

**Issue**: Database tests failing
**Solution**: Ensure PostgreSQL is running, using the repository Compose
file: `docker compose -f infra/docker/docker-compose.yml up -d postgres redis bifrost`

**Issue**: Async tests timing out
**Solution**: `pytest-timeout` is not installed and the `timeout` marker is
not registered, so there is no timeout marker to apply. Investigate the
awaited operation itself, and check the async configuration in
`tests/pytest.ini` (`--asyncio-mode=auto`).

**Issue**: Fixtures not found
**Solution**: Check `conftest.py` is in the right location and fixtures are properly defined

---

## Additional Resources

- [pytest Documentation](https://docs.pytest.org/)
- [Testing Best Practices](https://testdriven.io/blog/testing-best-practices/)
{% endraw %}
