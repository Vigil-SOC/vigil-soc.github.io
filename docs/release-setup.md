---
layout: docs
title: "Release Setup"
permalink: /docs/release-setup/
---

{% raw %}
One time setup for Vigil's automated release flow. Day to day releases
need no configuration on this page — see [RELEASING.md](/docs/releasing/)
for the release procedure. This document covers the GitHub App that
`.github/workflows/release-please.yml` depends on. The workflow runs on
push to `main` and `release/**` and on manual dispatch
(`workflow_dispatch`), where the operator can choose a `minor` /
`major` bump (default `minor`). There is no `patch` dispatch choice:
patch is forced automatically on `release/*` branches.

## Why a GitHub App

`release-please.yml` mints short lived (1 hour) tokens at runtime from a
GitHub App rather than using a long-lived personal access token. The App
is org owned, so releases keep working when individual maintainers
leave, and tokens auto-rotate so there is no manual key rotation chore.

## Required App permissions

Create a GitHub App on the `Vigil-SOC` org (org Owner role required) at
[github.com/organizations/Vigil-SOC/settings/apps](https://github.com/organizations/Vigil-SOC/settings/apps).
Grant only these **Repository permissions** — leave everything else at
"No access":

| Permission     | Access         | Why                                                       |
|----------------|----------------|-----------------------------------------------------------|
| Contents       | Read and write | Push a `Release-As:` commit directly to `main` and to `release/*` branches, create and delete `release/*` branches, push tags, and update `VERSION` / `CHANGELOG.md` (plus the other files release-please manages in `.github/release-please-config.json`) |
| Pull requests  | Read and write | Open and update the release PR                            |
| Issues         | Read and write | Link release notes to closed issues                       |
| Workflows      | Read and write | In case the release PR ever touches `.github/workflows/`  |

Uncheck "Active" under Webhooks (not needed). Restrict installation to
"Only on this account". Install the App on the `vigil` repo only.

## Add the App as a ruleset bypass actor

Add the App as a bypass actor on **both** rulesets:

- the `main branch protection` ruleset, and
- a **`release/**` ruleset mirroring main's**: pull requests and CI
  required for everyone else, the App as bypass actor, and the
  `Release guard` check required alongside CI.

The workflow's "Add Release-As commit" step uses the App token to commit
directly to the branch via the Git API, which branch protection would
otherwise block — on `main` and on release branches alike, because the
App also writes `Release-As` commits to release branches and
creates/deletes `release/*` branches. Without the bypass listing, that
step fails even when the App is installed and the repo configuration
below is set correctly. Without the `release/**` ruleset at all, the
flow still works, but the release branch is unprotected.

## Create the `backport` label

The backport flow (see [RELEASING.md](/docs/releasing/)) is driven by a
repo label. Create it once:

```bash
gh label create backport -d "Copy this merged fix onto the current release branch"
```

Label nothing `backport` until the vigil-factory default-branch-only
review setting is on. Without it the factory treats the copy PRs as
outside PRs, and can close them as already on `main` or merge `main`
into them.

## Wire it into the repo

`.github/workflows/release-please.yml` references two repo-level
configuration items by exact name. Set both at
[Settings → Secrets and variables → Actions](https://github.com/Vigil-SOC/vigil/settings/secrets/actions):

| Name                         | Tab           | Value                                                                                                                       |
|------------------------------|---------------|-----------------------------------------------------------------------------------------------------------------------------|
| `RELEASE_PLEASE_APP_ID`      | **Variables** | The numeric App ID shown on the App's settings page                                                                         |
| `RELEASE_PLEASE_PRIVATE_KEY` | **Secrets**   | Full contents of the `.pem` file generated under "Private keys" on the App's settings page (including the `BEGIN`/`END` lines) |

See GitHub's docs on
[managing private keys for GitHub Apps](https://docs.github.com/en/apps/maintaining-github-apps/managing-private-keys-for-github-apps)
for the mechanics of generating the `.pem`.

## Failure mode

If either configuration item is missing or empty, the "Mint GitHub App
token" step in `release-please.yml` fails immediately and no release PR
is opened. On the canonical `Vigil-SOC/vigil` repo, the symptom is that
every push to `main` (or a manual dispatch) produces a failed
release-please workflow run and no release PR appears in the PR list.
On forks the workflow is skipped entirely (repository guard), so no
failure appears.

If the App is not listed as a bypass actor on the `main branch
protection` ruleset, the "Add Release-As commit" step fails instead,
with an error stating that the ruleset must list the release-please
GitHub App as a bypass actor. The Mint step succeeds in this case; the
failure is in the direct-to-branch commit, not in token creation. The
same failure appears on a release branch, with the same symptom, if
the App is missing from the `release/**` ruleset's bypass actors —
fix releases then fail at exactly this step.
{% endraw %}
