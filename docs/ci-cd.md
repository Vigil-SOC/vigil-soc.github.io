---
layout: docs
title: "CI/CD Guide"
permalink: /docs/ci-cd/
---

{% raw %}
Complete guide to the CI/CD pipeline for Vigil.

## Table of Contents

- [Overview](#overview)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Pipeline Stages](#pipeline-stages)
- [Secrets Configuration](#secrets-configuration)
- [Deployment Process](#deployment-process)
- [Monitoring & Alerts](#monitoring--alerts)

---

## Overview

Vigil uses **GitHub Actions** for CI/CD. The `.github/workflows/` directory
contains 21 workflow files at the current release:

1. **ci-cd.yml**: Main pipeline for PRs and pushes
2. **release.yml**: Publishes release images on version tags
3. **release-please.yml**: Drives releases from merges to `main`
4. **nightly.yml**: Scheduled security audit
5. **connectors-live.yml**: Live connector tests
6. **erasure-nightly.yml**: Scheduled erasure checks
7. **helm-chart.yml**: Helm chart lint and testing
8. **medic.yml**, **medic-bundled-check.yml**, **medic-bundled-ratchet.yml**,
   **medic-helm.yml**, **medic-nightly.yml**, **medic-pack-refresh.yml**,
   **medic-pack-release.yml**: Medic checks, bundles, and pack releases
9. **backport.yml**: Copies `backport`-labelled fixes onto the release branch
10. **beta.yml**: Daily signed beta images of `main`
11. **beta-cleanup.yml**: Deletes beta images older than 14 days
12. **build-images.yml**: Reusable image build used by `release.yml` and `beta.yml`
13. **release-branch.yml**: Cuts `release/X.Y.x` at each minor tag
14. **release-guard.yml**: Guards fix releases (no schema change, ≤300 lines)
15. **scale-weekly.yml**: Weekly scale-limit run

Image publishing also happens outside `release.yml`: `beta.yml` runs
daily at 06:00 UTC, builds via `build-images.yml` (channel `beta`),
cosign-signs, and tags `<next-minor>.0-beta.<date>.<run>` plus a moving
`beta` tag (never `latest`/`stable`/`sha-`); `beta-cleanup.yml` deletes
beta images older than 14 days. The stable channel's tags include a
`stable` tag alongside the version, `X.Y`, `sha-…` and `latest` tags.

This page covers the three workflows most contributors interact with —
`ci-cd.yml`, `release.yml` (with `release-please.yml`), and `nightly.yml`.
There is **no automated deployment**: no workflow SSHes anywhere or deploys
to a staging or production VM.

### Pipeline Architecture

```
┌──────────────┐
│ Pull Request │
│  or Push     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Linting    │
│ Backend/FE   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Checks &   │
│ Schema Tests │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Security   │
│   Scanning   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Build Docker │
│ Images (CI,  │
│  not pushed) │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Build     │
│   Frontend   │
└──────────────┘
```

---

## GitHub Actions Workflows

### Main CI/CD Workflow

**File**: `.github/workflows/ci-cd.yml`

**Triggers**:
- Pull requests to `main` or `release/**`
- Pushes to `main` or `release/**`
- Manual: `workflow_dispatch`

**Jobs**:
1. `lint-backend` - Python linting (flake8, black, isort, mypy)
2. `lint-frontend` - TypeScript/React linting (ESLint)
3. `check-generated-api-types` - Generated API types are up to date
4. `lint-docker` - Dockerfile linting (hadolint)
5. `build-agent-image` - Build the agent image (not pushed)
6. `build-backend-image` - Build the backend image (not pushed)
7. `build-daemon-image` - Build the daemon image (not pushed)
8. `build-mcp-runner-image` - Build the MCP runner image (not pushed)
9. `test-setup-matrix` - Setup matrix tests
10. `typecheck-agent-layer` - Agent layer type checking
11. `check-entity-key-agreement` - Entity key agreement check
12. `test-helm-install-schema` - Helm install schema test (PostgreSQL service)
13. `security-scan-python` - Bandit SAST scanning (gates, see Stage 4)
14. `security-scan-npm` - NPM audit (gates, see Stage 4)
15. `build-frontend` - Build frontend static assets

### Release Workflow

**File**: `.github/workflows/release.yml`

**Triggers**:
- Tags matching `v[0-9]+.[0-9]+.[0-9]+` (e.g., v1.0.0) — only release-please
  `vX.Y.Z` tags

**Jobs**:
1. `version` - Resolve the `vX.Y.Z` version from the pushed tag
2. `build` - Build & push all four images via the reusable `build-images.yml` (channel `stable`; the smoke test runs inside it)
3. `sign` - Keyless cosign signing of the published images
4. `update-release` - Append the image digests to the GitHub Release notes, and build and attach the support tarball

> **No deployment runs here.** `release.yml` publishes images only; it does
> not SSH anywhere or deploy. The GitHub Release object itself is created by
> `release-please.yml`, not this workflow. See Stage 7: there is no
> automated deployment path.

### Nightly Tests

**File**: `.github/workflows/nightly.yml`

**Triggers**:
- Scheduled: 2 AM UTC daily
- Manual: workflow_dispatch

**Jobs**:
1. `security-audit` - pip-audit vulnerability scan
2. `notify` - Slack notification, on failure only (see Monitoring & Alerts)

`security-audit` audits `requirements.lock`, not `requirements.txt`, so it sees
the versions that actually install. Findings are reported, not fatal — but a
pip-audit that fails to *run* is, because it writes no report at all when it
errors and the job used to pass on that silence.

---

## Pipeline Stages

### Stage 1: Linting & Code Quality

**Backend Linting**:
```yaml
- flake8: Style checking          (gates)
- black: Code formatting          (gates)
- isort: Import sorting           (gates)
- import-linter: Layering         (gates)
- mypy: Type checking             (advisory)
```

Versions are pinned in `requirements-dev.txt`, which is also what
`.pre-commit-config.yaml` mirrors, so a local `pre-commit run` and CI agree.

**Frontend Linting**:
```yaml
- ESLint: JavaScript/TypeScript linting  (advisory)
```

For Dockerfiles, the backend hadolint step is advisory; only the
agent-image hadolint step gates.

**Exit Criteria**:
- The gating linters pass (flake8, black, isort, import-linter, and the
  agent-image hadolint step)
- Advisory checks (mypy, frontend ESLint, backend hadolint) report but do
  not fail the pipeline

### Stage 2: Checks and Schema Tests

`ci-cd.yml` does not run backend or frontend unit-test jobs, and no workflow
runs `pytest tests/unit/ tests/security/` or a frontend test script
(`clients/web/package.json` defines no test script at all). The
test-flavoured jobs that do run are:

- `test-setup-matrix` - Setup matrix tests
- `typecheck-agent-layer` - Agent layer type checking
- `check-entity-key-agreement` - Entity key agreement check
- `check-generated-api-types` - Generated API types are up to date
- `test-helm-install-schema` - Helm install schema test (Stage 3)

**Exit Criteria**:
- The jobs above pass
- No coverage threshold is enforced: `tests/pytest.ini` sets
  `--cov-fail-under=0`

### Stage 3: Helm Install Schema Test

There is no `test-integration` job and no `tests/integration/` run in CI.

**Setup** (in the `test-helm-install-schema` job):
- PostgreSQL container via GitHub Actions services
- Test database: `deeptempo_soc`

**Exit Criteria**:
- The Helm install schema test passes
- No database errors

### Stage 4: Security Scanning

Both scanners in this stage **gate** — either one can fail the pipeline.

**Python (Bandit)**:
```bash
bandit -r core/ services/ tools/ scripts/ -ll -ii
```

The `-ll -ii` thresholds gate on medium-or-higher severity and confidence.
A separate report step re-runs Bandit with `--exit-zero` to write a JSON
report, which is uploaded as an artifact for triage by hand:

```bash
bandit -r core/ services/ tools/ scripts/ -ll -ii -f json -o bandit-report.json --exit-zero
```

**NPM**:
```bash
npm audit --omit=dev --audit-level=high
```

This runs across `clients/web`, `services/agent`, and `clients/desktop`,
and the job fails (exit status 1) when high-or-worse findings are reported.

**Exit Criteria**: Bandit reports no medium-or-higher severity/confidence
findings, and npm audit reports no high-or-worse findings in the shipped
dependencies.

### Stage 5: Build Images

The per-image build jobs in `ci-cd.yml` build four images — agent, backend,
daemon, and MCP runner. Images are built locally on the runner
(`push: false`, `load: true`); they are **not** pushed from CI. GHCR pushes
happen only in `release.yml`.

**Backend Image** (`infra/docker/Dockerfile.backend`):
- Multi-stage build on `python:3.12-slim` (the version comes from
  `.python-version` / the `PYTHON_VERSION` build arg)
- Entrypoint:
```dockerfile
CMD ["python", "-m", "uvicorn", "services.api.main:app", "..."]
```

**Daemon Image** (`infra/docker/Dockerfile.daemon`):
```dockerfile
CMD ["python", "services/daemon/main.py"]
```

**Optimization**:
- Docker BuildKit for caching
- Multi-stage builds
- Layer caching via GitHub Actions

**Exit Criteria**:
- Images build successfully
- Tagged with branch and SHA
- Not pushed — publishing to GitHub Container Registry happens only in
  `release.yml`

### Stage 6: Container Scanning

There is no standalone image-scanning job. Trivy runs inside each
per-image build job in `ci-cd.yml`, via
`aquasecurity/trivy-action` (v0.36.0), against the locally built image.

**Behaviour**:
- Trivy reports HIGH and CRITICAL findings
- The job fails only on **fixable CRITICAL** findings
- Waivers live in `.trivyignore`
- No SARIF upload / GitHub Security upload is configured

**Exit Criteria**:
- No fixable CRITICAL vulnerabilities (after `.trivyignore` waivers)

### Stage 7: Deployment

> **Not currently enabled.** CI builds, scans, and publishes images, but
> no automated deployment runs — neither staging nor production. The
> `release.yml` workflow only builds and publishes images.
>
> The old manual deploy script, `scripts/deploy_to_vm.sh`, has been
> **deleted** from the repo — do not use it or any instructions based on
> it. The current local tooling is `scripts/vigil-compose.sh` (which wraps
> `infra/docker/docker-compose.yml`) and `scripts/vigil-upgrade.sh`;
> neither is a VM SSH deployer.

**Exit Criteria** (for a manual rollout of published images):
- Services healthy
- Smoke tests pass
- Rollback available

---

## Secrets Configuration

### Secrets and Variables the Workflows Actually Use

Configure in **Settings → Secrets and variables → Actions**:

#### Container Registry
```
GITHUB_TOKEN            # Auto-provided by GitHub Actions
```

#### Release automation
```
vars.RELEASE_PLEASE_APP_ID          # GitHub App ID used by release-please.yml
secrets.RELEASE_PLEASE_PRIVATE_KEY  # GitHub App private key for release-please.yml
```
These are also used by `connectors-live.yml`, `medic-pack-refresh.yml`,
and `medic-pack-release.yml`. The App token is also minted by
`backport.yml` and `release-branch.yml`.

#### Live connector tests
`connectors-live.yml` consumes vendor secrets for its live test suites
(the `LIVE_*` secrets, e.g. the vendor API keys and account identifiers
configured for that workflow).

#### Notifications (optional)
```
SLACK_WEBHOOK_URL       # Optional: failure notifications only (nightly.yml, connectors-live.yml, scale-weekly.yml)
```

No workflow consumes SSH/VM secrets, an Anthropic API key, or a Sentry DSN.
Sentry is configured from application settings at runtime, not from a CI
secret — see Sentry Integration under Monitoring & Alerts.

### Setting Secrets

```bash
# Via GitHub CLI
gh secret set SLACK_WEBHOOK_URL -b "https://hooks.slack.com/..."

# Via GitHub Web UI
1. Go to repository Settings
2. Click Secrets and variables → Actions
3. Click "New repository secret"
4. Add name and value
```

---

## Deployment Process

### Staging Deployment

There is no staging deployment. No workflow deploys to a staging VM on
merge to `main` (or on any other trigger) — CI builds, scans, and, for
releases, publishes images only.

### Production Deployment

> **Not automated.** Merging a release PR (below) pushes a version tag,
> which runs `release.yml`, which **builds and publishes images only** —
> it does not deploy. Deploying those images is a separate, manual step
> that is not wired into CI.

What a version tag (e.g. `v1.2.3`) actually triggers (`release.yml`):

1. Build & push the `vigil-backend`, `vigil-daemon`, `vigil-mcp-runner`,
   and `vigil-agent` images to GHCR
2. Smoke-test that the images start
3. Annotate the GitHub Release with the image digests

**Creating a Release** — releases are driven by `release-please`, not by
hand-pushing tags:

1. Merge the open **release PR** that `release-please` maintains on `main`.
2. On merge, `release-please` pushes the `vX.Y.Z` tag and creates the GitHub
   Release; that tag push triggers `release.yml` (above).

See the [Releasing guide](/docs/releasing/) for the full process.

### Rollback Procedure

There is no automatic rollback — there is no automated deployment to roll
back. Rollback is manual: re-run the previous published image version
locally with the compose tooling.

**Manual Rollback**:
```bash
# View available images
docker images | grep vigil

# Roll back to the previous version (image tags are pushed without the
# v prefix; git tags still use v)
export IMAGE_TAG=1.2.2  # Previous version
scripts/vigil-compose.sh up -d
```

`scripts/vigil-compose.sh` drives the Compose file at
`infra/docker/docker-compose.yml`.

---

## Performance Optimization

### Caching Strategy

**Docker Layer Caching**:
```yaml
- name: Build and push
  uses: docker/build-push-action@v7
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**NPM Caching**:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v7
  with:
    cache: 'npm'
    cache-dependency-path: clients/web/package-lock.json
```

There is no standalone `actions/cache` pip-caching step in `ci-cd.yml`;
npm caching is provided by `actions/setup-node` as shown above.

### Parallel Execution

Jobs run in parallel when possible:
- All linting jobs run concurrently
- Check and schema-test jobs run concurrently
- Security scans run in parallel

No pipeline duration figures are published here: the repo carries no
timing data to support them.

---

## Monitoring & Alerts

### Failure Notifications

Slack is used for **failure notifications only** — there are no deployment
notifications, because there are no deployments.

**Slack Integration** (as used in `nightly.yml`):
```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v4
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
    webhook-type: incoming-webhook
    payload: |
      {
        "text": "Nightly Security Audit Failed"
      }
```

**Notification Triggers**:
- Nightly security audit failure (`nightly.yml`, only when
  `SLACK_WEBHOOK_URL` is set)
- Live connector test failure (`connectors-live.yml` notify job)
- Scale run notification (`scale-weekly.yml`, via `slackapi/slack-github-action`)

### GitHub Status Checks

Job names that exist today and can be required in branch protection
include:
- lint-backend
- lint-frontend
- security-scan-python
- security-scan-npm
- build-frontend

The branch-protection settings themselves are configured on GitHub and
cannot be verified from the repository.

**Branch Protection Rules**:
```
Settings → Branches → Branch protection rules
✓ Require status checks to pass before merging
✓ Require branches to be up to date before merging
✓ Require linear history
```

### Sentry Integration

**Error Tracking**:
- Automatic error capture in production
- Performance monitoring
- Release tracking

**Configuration** (`core/platform/monitoring.py`): the DSN, environment,
and release come from application settings, not from environment-based
CI secrets:

```python
# core/platform/monitoring.py
sentry_sdk.init(
    dsn=sentry_dsn,
    environment=environment,
    release=release,
)
```

---

## Troubleshooting

### Pipeline Failures

**Build Failures**:
```bash
# Check logs
gh run view --log

# Rerun failed jobs
gh run rerun --failed
```

**Test Failures**:
```bash
# Run tests locally
pytest tests/unit/ -v --lf  # Run last failed

# Check test logs in GitHub Actions
Actions → Failed workflow → <job name> → Logs
```

**Local Stack Failures**:
```bash
# Check logs through the local compose tooling
scripts/vigil-compose.sh logs --tail=100

# Check service status
scripts/vigil-compose.sh ps
```

### Common Issues

**Issue**: Cache not working
**Solution**: Clear cache and rerun workflow

**Issue**: Docker build timeout
**Solution**: Optimize Dockerfile, reduce image size

**Issue**: Test database connection failed
**Solution**: Ensure PostgreSQL service is healthy in workflow

---

## Best Practices

### 1. Semantic Versioning

Use semantic versioning for releases:
- **v1.0.0**: Major release
- **v1.1.0**: Minor feature addition
- **v1.1.1**: Bug fix/patch

### 2. Commit Messages

Follow conventional commits:
```
feat: Add new case search functionality
fix: Resolve authentication token expiry issue
docs: Update API documentation
test: Add unit tests for Claude service
ci: Optimize Docker build caching
```

### 3. Pull Request Workflow

The repo's flow is `main`-centric:

1. Create a feature branch from `main`
2. Make changes and commit
3. Push and create a PR to `main`
4. Wait for CI checks to pass
5. Request code review
6. Merge to `main`
7. Releases are cut from `main` by `release-please` (see Creating a
   Release above)

(`ci-cd.yml` triggers on `main` and `release/**`; there is no `develop`
trigger branch.)

### 4. Emergency Hotfixes

```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-bug

# Make fix and test locally
pytest tests/

# Commit and push
git commit -m "fix: Resolve critical bug"
git push origin hotfix/critical-bug
```

Create a PR directly to `main`. Minors are released by merging `main`'s
standing release PR by hand. For a fix to a shipped release, label the
merged fix `backport`: `backport.yml` cherry-picks it onto the
`release/X.Y.x` branch that `release-branch.yml` cut at the minor tag,
under `release-guard.yml` (a fix release may not change the schema and
must stay within 300 changed lines). Do not hand-push a version tag;
hand-pushed tags are not the release mechanism, and `release.yml` only
accepts release-please `vX.Y.Z` tags.

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
{% endraw %}
