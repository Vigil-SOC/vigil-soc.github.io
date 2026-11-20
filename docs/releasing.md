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

Releases are driven by [release-please](https://github.com/googleapis/release-please)
from two kinds of branch. Maintainers do not hand-bump versions or
hand-tag releases — both are automated. `.github/workflows/release.yml`
builds, signs and publishes the four GHCR images for any `vX.Y.Z`
tag, whichever branch it was cut from.

| Branch | Releases | How |
|---|---|---|
| `main` | Minors (`1.2.0`, `1.3.0`, …) and majors | A maintainer merges `main`'s release PR |
| `release/X.Y.x` | Fix releases (`X.Y.1`, `X.Y.2`, …) | A maintainer merges that branch's release PR |

A merge to `main` makes no release. Daily betas of `main` are a
separate path (see "Daily beta images" below).

The release-please config (`.github/release-please-config.json`)
sets `"versioning": "always-bump-minor"`, so commit prefixes do not
decide the bump. The workflow (`.github/workflows/release-please.yml`)
runs on push to `main` and `release/**` and itself adds an empty
`Release-As:` commit to the branch: on `main` it forces the next
minor; on a release branch it pins the next patch (see "Fix
releases").

### A minor release, by hand

`main` always has one open release PR, titled for the next minor
(`chore(main): release 1.3.0`). It collects the changelog as PRs
merge and stays open until a maintainer decides it is time. The PR
bumps every file listed under "What Gets Versioned" above and
updates `CHANGELOG.md`. Because the config sets
`"changelog-type": "github"`, the changelog is a flat "What's
Changed" list of PR titles and authors, with no per-type sections
and no "Other" section.

To release, merge the release PR. That tags `v1.3.0`, which:

1. runs `release.yml` to build and publish the images, and
2. runs `.github/workflows/release-branch.yml`, which creates
   `release/1.3.x` at the tag's commit and deletes every other
   `release/*` branch.

There is exactly one release branch at a time, so the previous line
stops getting fixes the moment the new minor ships.

### A major release

Run the **release-please** workflow from `main` with `major`
(**Actions → release-please → Run workflow**), then merge the PR it
opens or updates. Manual dispatch is the major path only: the
workflow's `bump` input offers `minor` / `major` (default `minor`)
— there is no `patch` dispatch choice, because patch is forced
automatically on release branches.

### Fix releases

A fix release carries no database migration and no schema change.
Every fix merges to `main` first. Nothing merges from `main` into
the release branch, or back.

A commit landing on `release/X.Y.x` makes release-please open a
release PR on that branch for `X.Y.(Z+1)`. Merging it tags
`vX.Y.(Z+1)` and `release.yml` builds it. The release PR bumps only
the patch: the workflow adds a `Release-As: X.Y.(Z+1)` commit to
the branch, which pins the version whatever `main`'s versioning
setting says.

The release branch carries its own
`.github/.release-please-manifest.json`, which starts at `X.Y.0`.
After a fix release, `main`'s manifest and `VERSION` still read
`X.Y.0`; that is expected. Betas are numbered from `main`'s
`VERSION`.

CI (the CI/CD Pipeline, and the Helm chart check for chart changes)
runs on pushes to and pull requests into `release/**`, as it does
for `main`.

#### Backporting a fix

Add the `backport` label to a PR that merged into `main`, or label
it before it merges: the copy starts when the PR is merged and
labelled, whichever happens last. `.github/workflows/backport.yml`
then:

- cherry-picks the PR's squash commit onto `release/X.Y.x` with
  `git cherry-pick -x` (the copy names the original commit, and
  keeps its title for the release changelog), and opens
  `Backport #N: <title>` into that branch with the release-please
  App token, so CI runs on it;
- opens it as a **draft with the conflict markers committed** if
  the commit does not apply cleanly, and does nothing more. It
  fails CI by design until someone resolves the conflicts and
  marks it ready;
- comments on the PR and stops if no release branch exists yet,
  and stops if a `backport/N-*` branch already exists (the label
  was added twice).

Only that one commit is copied. A fix that depends on earlier
commits that are not on the release branch conflicts; resolve it
by hand or leave it on `main`.

#### Release guard

`.github/workflows/release-guard.yml` runs on every PR into
`release/**`, backports or not, and fails when the PR:

- changes anything under `core/upgrade/versions/` or
  `core/upgrade/head_schema.json` (no migration or schema change
  in a fix release), or
- changes more than 300 lines, added plus deleted (too big to be
  a fix).

Release PRs go through the same check; they only touch the
manifest and changelog.

### Daily beta images

`.github/workflows/beta.yml` publishes a daily (06:00 UTC, plus
manual dispatch) signed build of `main`, tagged
`<next-minor>.0-beta.<date>.<run>` plus a moving `beta` tag. It is
skipped when `main`'s head is unchanged since the current beta, or
when CI did not finish green on `main`'s head. Betas are images
only: no git tag, no GitHub Release, and never the `latest`,
`stable`, `X.Y` or `sha-` tags — `release.yml` owns those. A beta
may include database migrations, which have no downgrade.

`.github/workflows/beta-cleanup.yml` deletes beta images older
than 14 days, weekly. It never deletes the image the `beta` tag
points to, and never touches stable images.

Stable-channel tags (from the shared
`.github/workflows/build-images.yml`) are `<version>`, `X.Y`,
`sha-<short>`, `latest` and `stable`; the beta channel gets only
`<version>` and `beta`.

## Forcing a specific version

Forcing a version is no longer an exotic override: on ordinary
pushes the workflow itself auto-generates a `Release-As:` commit
(the next minor on `main`, the next patch on a release branch —
see "How a Release Happens" above). A hand-written `Release-As:`
trailer is still the way to force a specific version outside that
scheme — to unstick a stalled release PR, to reserve a milestone
version, or to skip a number on purpose. Push an empty commit with
a `Release-As:` trailer:

```bash
git commit --allow-empty \
  -m "chore: release 1.0.1" \
  -m "Release-As: 1.0.1"
git push origin main
```

The next release-please run reads the trailer and forces the
release PR to use that exact version, regardless of the version
the workflow would otherwise compute. The override is one-shot —
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

The steps below are the **minor-from-`main`** variant. A manual **fix**
release is different: cut it from `release/X.Y.x`, bump only that
branch's own manifest and versioned files to `X.Y.(Z+1)`, and tag from
the branch — never bump `main`'s manifest for a fix, and never put a
migration or schema change in it (the release guard's limits in "Fix
releases" above are the rule, even by hand). After a manual minor tag,
expect `release-branch.yml` to create `release/X.Y.x` at the tag and
delete the other `release/*` branches, exactly as for an automated
minor.

1. Open a PR bumping the version to the new release (e.g. `1.1.0`) in
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
   git tag -s v1.1.0 -m "Release v1.1.0"
   git push origin v1.1.0
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

- **Re-deploy an old tag** — add a `workflow_dispatch` trigger with a
  `tag` input to `release.yml`, so a previously-released version can be
  rebuilt without moving the tag.
{% endraw %}
