---
layout: docs
title: "Releasing"
permalink: /docs/releasing/
---

{% raw %}
How Vigil is versioned and released.

## Versioning Policy

Vigil follows [Semantic Versioning](https://semver.org/).

- **`1.x.y` (current)** — Stable. Breaking changes require a major bump
  (e.g. `2.0.0`). Minor releases (`1.1.0`) add backward-compatible functionality,
  and patch releases (`1.0.1`) provide backward-compatible bug fixes.
- **`0.x.y` (historical)** — Pre-stable releases prior to `1.0.0` General
  Availability. Minor releases served as feature increments with possible
  schema adjustments, while patch releases fixed bugs.

## What Gets Versioned

| File                          | Field                              | Managed by release-please     |
|-------------------------------|------------------------------------|-------------------------------|
| `VERSION`                     | (whole file)                       | yes                           |
| `scripts/vigil-support/VERSION` | (whole file)                     | yes                           |
| `infra/helm/vigil/Chart.yaml`       | `appVersion`                       | yes                           |
| `infra/helm/vigil/Chart.yaml`       | `version`                          | yes (lockstep with appVersion)|
| `clients/web/package.json`       | `version`                          | yes                           |
| `clients/web/package-lock.json`  | `version` (root + `packages['']`)  | yes                           |
| `clients/desktop/package.json`   | `version`                          | yes                           |
| `clients/desktop/package-lock.json` | `version` (root + `packages['']`) | yes                        |
| `clients/claude-code/.claude-plugin/plugin.json` | `version`           | yes                           |

See "Chart version vs appVersion" below for why both chart fields are
bumped together.

The Python backend reads `VERSION` directly at import time (see
`core/version.py`), so the `core.version.__version__` attribute and the
`version` field reported by the health and root endpoints (including
`/api/health` and `/api/health/ready`) stay in sync with `VERSION`
automatically. No release-please configuration is needed for the backend.
The FastAPI app's own `version` is separate: it is the frozen
API-contract version `"1"`, not the application version.

## How a Release Happens

Releases are driven by [release-please](https://github.com/googleapis/release-please).
Maintainers do not hand-bump versions or hand-tag releases — both are
automated.

1. Every push to `main` runs `.github/workflows/release-please.yml`.
2. Every release is a patch by default. The release-please config
   (`.github/release-please-config.json`) sets
   `"versioning": "always-bump-patch"`, so commit prefixes do not
   decide the bump. To ensure a release PR is opened or updated even
   when merged PR titles carry no conventional prefix, the workflow
   itself adds an empty commit to `main` — `chore: release X.Y.Z` with
   a `Release-As: X.Y.Z` trailer — computing the next patch version
   from `.github/.release-please-manifest.json`. It skips this step
   only when the head commit is already a release commit or a release
   PR labelled `autorelease: pending` is already open.
3. For a minor or major release, a maintainer runs the workflow
   manually via `workflow_dispatch` and selects the `bump` input
   (`patch`, `minor`, or `major`; default `patch`). Minor and major
   bumps come from that manual dispatch, not from landing a `feat:` or
   `feat!:` commit.
4. release-please opens (or updates) a single **release PR** titled
   `chore(main): release X.Y.Z`. The PR bumps every file listed under
   "What Gets Versioned" above and updates `CHANGELOG.md`. Because the
   config sets `"changelog-type": "github"`, the changelog is a flat
   "What's Changed" list of PR titles and authors, with no per-type
   sections and no "Other" section.
5. The release PR stays open and accumulates more commits as they merge.
   This is the grouping mechanism — every commit since the last release
   lives in one PR until you ship.
6. When ready, a maintainer merges the
   release PR. The merge causes release-please to push tag `vX.Y.Z` and
   create a GitHub Release.
7. The tag push triggers `.github/workflows/release.yml`, which builds
   and publishes artifacts.

Human decisions per release are **when to merge the release PR** and,
for a minor or major release, **running the workflow manually and
selecting that bump**.

## Forcing a specific version

Forcing a version is no longer an exotic override: on ordinary pushes
the workflow itself auto-generates a `Release-As:` commit for the next
patch version (see "How a Release Happens" above), and minor/major
bumps are selected via the workflow's `workflow_dispatch` `bump`
input. A hand-written `Release-As:` trailer is still the way to force
a specific version outside that scheme — to unstick a stalled release
PR, to reserve a milestone version, or to skip a number on purpose.
Push an empty commit to `main` with a `Release-As:` trailer:

```bash
git commit --allow-empty \
  -m "chore: release 1.0.1" \
  -m "Release-As: 1.0.1"
git push origin main
```

The next release-please run reads the trailer and forces the release
PR to use that exact version, regardless of the patch version the
workflow would otherwise compute. The override is one-shot —
subsequent merged commits go back to normal accounting.

## Chart Version vs appVersion

The Helm chart has two version fields:

- **`appVersion`** — the Vigil release the chart deploys.
- **`version`** — the chart packaging version. Helm clients, `helm package`
  tarball names (`vigil-X.Y.Z.tgz`), Helm's local cache, and ArtifactHub all
  key off this field, not `appVersion`. If chart contents change without a
  `version` bump, consumers see "no new chart" even though the bytes
  differ — silent breakage.

release-please bumps **both fields in lockstep** with every release. This
is a deliberate trade-off: it gives up the (rarely-used) ability to ship a
chart-only patch with a chart `version` bump but no app version bump, in
exchange for eliminating a drift footgun that's hard to catch in review
(release-please's YAML library reformats `Chart.yaml` when it edits, which
can produce semantically-equivalent but byte-different output).

| Change                              | `appVersion` | chart `version` |
|-------------------------------------|--------------|-----------------|
| Any release-please release          | bumps        | bumps           |

If you ever need a chart-only fix between app releases (e.g. a Helm
template hotfix with no app code change), edit `infra/helm/vigil/Chart.yaml`'s
`version` manually in a separate PR outside the release-please flow. This
is the escape hatch, not the default path.

## GitHub App Setup

The automated flow above depends on a GitHub App (referenced as
`vars.RELEASE_PLEASE_APP_ID` and `secrets.RELEASE_PLEASE_PRIVATE_KEY` in
`release-please.yml`) that mints short-lived tokens at runtime, no
long-lived PATs, no per maintainer ownership. The App is **one time
setup per fork**; once installed, day to day releases need no further
configuration here.

For initial setup or recreating the App, see
[docs/RELEASE_SETUP.md](/docs/release-setup/), covers required
permissions, App creation, `.pem` generation, and where to put the App
ID and private key.

## Manual Release (fallback)

If release-please is broken or unavailable, cut a release by hand. The
manual flow must update **everything** release-please normally manages,
including the manifest file that tracks the last-released version. If
the manifest is not bumped, the next automated run reads its stale
value, thinks the manual release never happened, and opens a release PR
that overwrites it.

1. Open a PR bumping the version to the new release (e.g. `1.0.1`) in
   all of the following:
   - `VERSION`
   - `scripts/vigil-support/VERSION`
   - `infra/helm/vigil/Chart.yaml` `appVersion`
   - `infra/helm/vigil/Chart.yaml` `version` (lockstep with `appVersion`)
   - `clients/web/package.json` `version`
   - `clients/web/package-lock.json` — both `$.version` and
     `$.packages[''].version`
   - `clients/desktop/package.json` `version`
   - `clients/desktop/package-lock.json` — both `$.version` and
     `$.packages[''].version`
   - `clients/claude-code/.claude-plugin/plugin.json` `version`
   - `.github/.release-please-manifest.json` — set the `"."` entry to
     the new version
   - `CHANGELOG.md` — prepend a section with the new version, date, and
     a summary of changes since the previous tag
2. Merge the PR.
3. Tag and push:
   ```bash
   git checkout main && git pull
   git tag -s v1.0.1 -m "Release v1.0.1"
   git push origin v1.0.1
   ```
4. The tag push triggers `release.yml` (build and publish the four
   GHCR images, smoke-test, update the Release notes).
5. **Manually create the GitHub Release** at
   [github.com/Vigil-SOC/vigil/releases/new](https://github.com/Vigil-SOC/vigil/releases/new),
   selecting the tag you just pushed. release-please normally creates
   this; in manual mode nothing else will. Use the `CHANGELOG.md`
   section you wrote as the Release body.

## Future Improvements

Tracked separately, not part of the current release flow:

- **Hotfix branches** — now that `1.0.0+` is GA and we may need to ship fixes for
  older majors, document a `release/X.Y` branch procedure.
- **Re-deploy an old tag** — add a `workflow_dispatch` trigger with a
  `tag` input to `release.yml`, so a previously-released version can be
  rebuilt without moving the tag.
{% endraw %}
