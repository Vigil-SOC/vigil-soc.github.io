---
layout: docs
title: "GitHub Workflows"
permalink: /docs/github-workflows/
---

{% raw %}
This page describes the CI/CD workflows for Vigil, which live in `.github/workflows/` in the code repository.

## Current Configuration

The main pipeline, `ci-cd.yml`, is **Continuous Integration** only — it lints, checks, scans, and builds Docker images, but pushes nothing and deploys nowhere. Publishing happens in separate workflows: `release.yml` pushes images to GitHub Container Registry on version tags, `connectors-live.yml` publishes the connector matrix to this docs site, and `medic-pack-release.yml` publishes GitHub Releases for the Medic pack.

### What Runs Automatically

✅ **On push or pull request to `main` or `develop`** (plus manual `workflow_dispatch`), with jobs gated to the canonical `Vigil-SOC/vigil` repository, `ci-cd.yml` runs:
- Linting (Python, TypeScript, Dockerfile)
- Security scanning (Bandit, npm audit)
- Docker image building
- Container vulnerability scanning (Trivy)
- A setup-path smoke matrix and a Helm install-schema test
- Generated API type, entity-key agreement, and agent-layer type checks

Note: `ci-cd.yml` does not run unit or integration test suites.

✅ **Result**:
- Checks verify your code
- Docker images are built locally with `:ci` tags only — CI does not push them to GitHub Container Registry
- No deployment

## Workflows

### 1. `ci-cd.yml` - Main CI Pipeline
- **Triggers**: Push or PR to main/develop, manual dispatch
- **Purpose**: Lint, scan, check, and build images
- **Deployment**: Disabled (testing and building only; images are not pushed)

### 2. `release-please.yml` - Automated Release PRs
- **Triggers**: Push to `main`, manual dispatch
- **Purpose**: Open or update a release PR that bumps `VERSION`, `scripts/vigil-support/VERSION`, `infra/helm/vigil/Chart.yaml` (both `appVersion` and `version`, in lockstep), `clients/web/package.json`, `clients/web/package-lock.json`, `clients/desktop/package.json`, `clients/desktop/package-lock.json`, and `clients/claude-code/.claude-plugin/plugin.json`, and updates `CHANGELOG.md`. Versioning is `always-bump-patch`: the workflow adds an empty `Release-As:` commit so a release PR opens even when merged PR titles carry no conventional prefix, defaulting to a patch bump (minor/major only via manual dispatch input). On merge, push the `vX.Y.Z` tag and create the GitHub Release. See [Releasing](/docs/releasing/).
- **Deployment**: None (tagging only — downstream `release.yml` handles image publishing)

### 3. `release.yml` - Tag-Triggered Image Build & Publish
- **Triggers**: Version tags matching `v[0-9]+.[0-9]+.[0-9]+`
- **Purpose**: Build and push the `vigil-backend`, `vigil-daemon`, `vigil-agent`, and `vigil-mcp-runner` images to GHCR (tagged with the semver version, `major.minor`, `sha-*`, and `latest`), cosign-sign each image, smoke-test that they start, and annotate the GitHub Release with the image digests. The GitHub Release object itself is created by `release-please.yml`, not this workflow.
- **Deployment**: None — this workflow publishes images only, it does not deploy.

### 4. `nightly.yml` - Scheduled Security Audit
- **Triggers**: Daily at 2 AM UTC
- **Purpose**: Run a pip-audit security audit and notify on failure
- **Deployment**: None

### 5. `connectors-live.yml` - Live Connector Checks
- **Triggers**: Mondays at 6 AM UTC, manual dispatch
- **Purpose**: Run each connector in `mcp-config.json` that can be run for free against a real instance — self-hosted backends in Docker, keyless servers, and free vendor tiers — and merge the results into the connector matrix (job summary and `connector-matrix` artifact). Vendor-tier probes read `LIVE_*` repository secrets (e.g. `LIVE_SHODAN_API_KEY`, `LIVE_OKTA_API_TOKEN`); a probe whose secret is unset reports "not configured". `tests/live/ACCOUNTS.md` lists the accounts and secret names.
- **Deployment**: Runs on `main` publish the matrix to `_data/connector_matrix.json` in this site, which renders the status table on the [Integrations](/docs/integrations/) page. Publishing happens only on `main` and only when all three report files (`live-search-backends.json`, `live-local.json`, `live-free-tier.json`) are present; runs on other branches publish nothing.

### 6. `helm-chart.yml` - Helm Chart Checks
- **Triggers**: Push or PR touching the Helm chart paths
- **Purpose**: Check the Helm chart under `infra/helm/`
- **Deployment**: None

### 7. `erasure-nightly.yml` - Nightly Erasure Test
- **Triggers**: Daily at 5 AM UTC
- **Purpose**: Verify parallel principal erasures across two backend replicas lose no IDs
- **Deployment**: None

### 8. `medic.yml` - Medic CI
- **Triggers**: Push or PR touching Medic paths
- **Purpose**: Run Medic's own lint and gates, separate from `ci-cd.yml`
- **Deployment**: None

### 9. `medic-helm.yml` - Medic Helm Checks
- **Triggers**: Push or PR touching Medic Helm paths
- **Purpose**: Render-test Medic's Helm isolation and run it live on kind, with and without a NetworkPolicy controller
- **Deployment**: None

### 10. `medic-bundled-check.yml` - Medic Bundled Pack Check
- **Triggers**: Pull requests to `main`
- **Purpose**: Verify the bundled Medic pack file matches the medic-core Release asset byte for byte
- **Deployment**: None

### 11. `medic-bundled-ratchet.yml` - Medic Bundled Pack Freshness
- **Triggers**: Pull requests to `main` touching the pack or version paths
- **Purpose**: Fail a release whose bundled Medic pack is stale for its `VERSION` or near expiry
- **Deployment**: None

### 12. `medic-nightly.yml` - Medic Nightly Evaluation
- **Triggers**: Daily at 3:30 AM UTC
- **Purpose**: Run Medic's evaluation suites on Compose and on Helm/kind and upload the metrics artifact
- **Deployment**: None

### 13. `medic-pack-refresh.yml` - Medic Pack Refresh
- **Triggers**: Daily at 6:17 AM UTC, manual dispatch
- **Purpose**: When the bundled medic-core pack is within 75 days of expiring, open a PR refreshing its `pack.yaml` expiry
- **Deployment**: None (opens a PR; it never pushes to `main`)

### 14. `medic-pack-release.yml` - Medic Pack Release
- **Triggers**: Push to `main` changing the medic-core pack version
- **Purpose**: Build the pack, tag it `medic-core-v<version>`, publish a GitHub Release carrying the file and its SHA-256, and open a PR committing the file to the bundled pack directory
- **Deployment**: None (publishes a GitHub Release and opens a PR; it never pushes to `main`)

## Secrets and Tokens

Most workflows need no configured secrets, and none use `SSH_PRIVATE_KEY`, VM host variables, or `SENTRY_DSN`. But `GITHUB_TOKEN` is not the only credential in play:

- `release-please.yml` and `connectors-live.yml` mint a GitHub App token from `vars.RELEASE_PLEASE_APP_ID` and `secrets.RELEASE_PLEASE_PRIVATE_KEY` (the latter also to publish the connector matrix to this docs site).
- `connectors-live.yml` reads `LIVE_*` repository secrets for vendor-tier probes (e.g. `LIVE_SHODAN_API_KEY`, `LIVE_OKTA_API_TOKEN`).
- `nightly.yml` and `connectors-live.yml` read `SLACK_WEBHOOK_URL` to notify on failure, when it is configured.

`GITHUB_TOKEN` itself is **automatically provided** by GitHub Actions.

## Running Your App Manually

Published images are available from GHCR under the `latest` tag or a version tag:

```bash
# Pull the published images
docker pull ghcr.io/vigil-soc/vigil-backend:latest
docker pull ghcr.io/vigil-soc/vigil-daemon:latest

# Run with the compose file in the code repository
docker compose -f infra/docker/docker-compose.yml up -d
```

The compose setup is also driven by `scripts/vigil-compose.sh` and `start.sh` in the code repository.

## Future: Enabling Deployment

No workflow currently deploys Vigil, and there is no deployment job waiting to be switched on — `ci-cd.yml` has no `deploy-staging` job, commented or otherwise. Enabling deployment means writing a new job (and configuring the secrets and targets it needs).

For more detail, see:
- [CI/CD Guide](/docs/ci-cd/) - Full CI/CD documentation
- [Deployment Guide](/docs/deployment/) - Deployment guide
{% endraw %}
