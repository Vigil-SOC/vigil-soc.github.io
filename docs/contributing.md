---
layout: docs
title: "Contributing to Vigil"
permalink: /docs/contributing/
---

{% raw %}
Thank you for your interest in contributing to Vigil. This document covers how to get started, how to submit changes, and how to find things to work on.

## Getting Started

### Prerequisites

- Python 3.12 (pinned in `.python-version`)
- Node.js 20+
- Docker (must be running)
- Git

An LLM provider is not a prerequisite: configure one in the UI under
Settings → AI models → Providers & Keys, or use a local Ollama model,
which needs no key.

### Local Setup

```bash
git clone https://github.com/Vigil-SOC/vigil.git
cd vigil
./start.sh
```

Access the frontend at http://localhost:6988 and the API at http://localhost:6987.

See the [README](https://github.com/Vigil-SOC/vigil/blob/main/README.md) for full setup instructions including manual install and Docker options.

## How to Contribute

### Fork and Pull Request Workflow

1. **Fork** the repository to your GitHub account
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/vigil.git
   cd vigil
   ```
3. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** and test them
5. **Commit** with sign-off (required — see below):
   ```bash
   git commit -s -m "Add new MCP integration for SentinelOne"
   ```
6. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** from your fork to `Vigil-SOC/vigil:main`

### Sign-Off Requirement (DCO)

All commits must include a `Signed-off-by` line certifying you have the right to submit the code under Vigil's Apache 2.0 license. This is the [Developer Certificate of Origin](https://github.com/Vigil-SOC/vigil/blob/main/DCO).

Add it automatically with the `-s` flag:

```bash
git commit -s -m "Your commit message"
```

This adds a line like `Signed-off-by: Your Name <your@email.com>` using your git config identity. Configure it once:

```bash
git config user.name "Your Name"
git config user.email "your@email.com"
```

### Versioning and Releases

Vigil follows [Semantic Versioning](https://semver.org/). At 1.x, the
`/api/v1` surface is frozen and changes only additively within a major;
removal or an incompatible shape change is a major bump. See
`VERSIONING.md` in the repository for the full 1.x contract, and
[`RELEASING.md`](/docs/releasing/) for the full release process.

The Helm chart at `infra/helm/vigil/` has two version fields: `appVersion`
(the Vigil release the chart deploys) and chart `version` (the chart
packaging version). release-please bumps **both in lockstep** on every
release. See [`RELEASING.md`](/docs/releasing/) for the rationale and the
escape hatch for chart-only changes between app releases.

## What to Work On

### Good First Issues

Look for issues labeled [`good-first-issue`](https://github.com/Vigil-SOC/vigil/labels/good-first-issue) — these are scoped, well-defined tasks suitable for new contributors.

### Contribution Areas

Contributions are welcome across all areas:

- **New MCP integrations** — connect Vigil to additional security tools (EDR, SIEM, cloud, ticketing)
- **Agent improvements** — enhance agent prompts, reasoning, or tool usage
- **New Workflows** — define new multi-agent workflows in `core/workflows/definitions/`
- **Detection rules** — add Sigma, Splunk, Elastic, or KQL rules
- **Bug fixes** — check the issue tracker
- **Documentation** — improve docs, add examples, fix errors
- **Tests** — expand test coverage

## Code Guidelines

### Project Structure

```
vigil/
├── core/            # Shared library: capability domains + storage/platform tier
│   └── workflows/definitions/   # Multi-agent workflow definitions (WORKFLOW.md files)
├── services/        # Deployables only: agent, api (FastAPI), daemon
│                    #   (headless autonomous SOC), mcp_runner, medic,
│                    #   medic_dockerproxy, medic_gateway, worker (ARQ llm-worker)
├── clients/web/     # React web client
├── tools/           # MCP servers and related tooling
├── scripts/         # Setup, startup and maintenance scripts
├── infra/           # Docker Compose, Helm chart, DB init SQL
├── data/            # Schemas, registry, taxonomy
├── docs/            # Documentation
└── tests/           # Test suite
```

### Style

`flake8`, `black` and `isort` gate CI over `services/` and `core/`. Install the
pinned toolchain and the hook that matches it once:

```bash
pip install -r requirements-dev.txt && pre-commit install
```

Pass the tools no arguments — the tools read `setup.cfg` for their
configuration, and pre-commit pins matching hook versions separately in
`.pre-commit-config.yaml`, so formatting locally cannot produce a tree CI
rejects. `./setup_dev.sh` does both steps for you.

- Python: follow existing patterns in `core/`. Use type hints. `core/` must not
  import `services/`, and `core/storage` + `core/platform` must not import a
  capability domain — `.importlinter` gates both; run `lint-imports` locally.
- TypeScript/React: follow existing patterns in `clients/web/`.
- Workflows: follow the format of existing
  `core/workflows/definitions/*/WORKFLOW.md` files.
- MCP servers: follow the patterns in `tools/`.

### Testing

Run the test suite before submitting:

```bash
pytest tests/
```

Pytest configuration lives in `tests/pytest.ini`.

New features should include tests. Place them in `tests/` following existing naming conventions.

### Commit Messages

We **prefer** [Conventional Commits](https://www.conventionalcommits.org/) so we
can automate changelogs and version bumps via
[release-please](https://github.com/googleapis/release-please) (see
[`RELEASING.md`](/docs/releasing/)). It is not strictly enforced at the
per-commit level — if your individual commits don't match the format, please
update your **PR title** to follow the convention before requesting review
(since we squash-merge, the PR title becomes the commit on `main`). If you
forget, a maintainer may adjust the title before merging. The DCO sign-off
(`git commit -s`), however, is required on every commit.

The preferred format is:

```
<type>(<optional scope>): <short summary>

<optional body explaining what and why>

Signed-off-by: Your Name <your@email.com>
```

**Common types:**

- `feat:` — a new feature
- `fix:` — a bug fix
- `docs:` — documentation only
- `chore:` — tooling, build, dependency bumps
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or fixing tests
- `perf:` — performance improvement

Releases currently always bump patch, regardless of commit type, per
`"versioning": "always-bump-patch"` in `.github/release-please-config.json`.

**Common scopes for Vigil:** `agents`, `workflows`, `mcp`, `frontend`,
`daemon`, `helm`, `api`, `db`.

**Breaking changes:** add `!` after the type/scope (`feat!:`) or include
`BREAKING CHANGE:` in the body.

**Examples:**

```
feat(mcp): add SentinelOne integration
fix(daemon): prevent double-processing of correlated alerts
docs(workflows): clarify threat-hunt phase ordering
chore(deps): bump fastapi to 0.162.2
feat(agents)!: rename Triage agent prompt schema
```

## Pull Request Guidelines

- One logical change per PR
- Include tests for new functionality
- Update relevant documentation
- Reference related issues: "Closes #123" or "Part of #456"
- Keep PRs reviewable — if a feature is large, break it into smaller PRs

### Pull Request Titles

Because we squash-merge PRs, the PR title becomes the commit message on
`main` — which is what `release-please` reads to build changelog entries. **Setting a Conventional Commits-style PR title is the
author's responsibility** (e.g., `feat(mcp): add SentinelOne integration`).
You can update the title at any point before merge by editing the PR. If
you forget, a maintainer may adjust it before merging, but please don't
rely on that.

## Reporting a Security Vulnerability

Do **not** open a public issue or pull request for a security vulnerability.
Report it privately through [GitHub's private vulnerability
reporting](https://github.com/Vigil-SOC/vigil/security/advisories/new) or by
email to [security@deeptempo.ai](mailto:security@deeptempo.ai). See
[SECURITY.md](https://github.com/Vigil-SOC/vigil/blob/main/SECURITY.md) for scope, response targets, our coordinated
disclosure window, and safe harbor.

## Community

Join us on [Discord](https://discord.gg/nVprk5uHGq) to discuss ideas, get help, and collaborate.

## License

By contributing to Vigil, you agree that your contributions will be licensed under the [Apache 2.0 License](https://github.com/Vigil-SOC/vigil/blob/main/LICENSE).
{% endraw %}
