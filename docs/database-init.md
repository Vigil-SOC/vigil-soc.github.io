---
layout: docs
title: "Database Init SQL"
permalink: /docs/database-init/
---

{% raw %}
The `*.sql` files under `infra/database/init/` are **legacy** schema
scripts. They are not how a Vigil database is built or changed at this
release, on either deploy path. They are retained because the upgrade
path still reads them when adopting a 0.7.0 or 0.8.0 install, and
because dev and test tooling uses them as a reference — see below.

## How the schema is actually applied

`python -m core.upgrade`, run from the backend image as the database
owner, is the only schema writer. The Helm values file states this
directly, and the code repo's upgrading guide repeats it: it is the one
thing that changes Vigil's database schema.

- **Fresh installs** are built from
  `core/upgrade/versions/0001_baseline.sql` plus the numbered revisions
  that follow it under `core/upgrade/versions/`. Revisions are chained
  by their `down_revision` links, and the applied revision is tracked
  in the `alembic_version` table.
- **docker-compose** runs the upgrade as a one-shot service before the
  API, daemon, workers and agent processes start. The postgres service
  mounts no init directory, and its compose comment is explicit: "First
  boot must not apply infra/database/init."
- **Helm** runs the same command from hook Jobs defined in
  `infra/helm/vigil/templates/upgrade.yaml` — a pre-upgrade check and
  apply, and a post-install Job that takes an empty database to head.
  There is no chart bundle copy of the init files, no `dbInit.sqlFiles`
  value, and no `db-init` Job. `infra/helm/vigil/files/` holds only the
  Bifrost config and the Helm upgrade helper.

## What the init files are still for

- **Adoption of 0.7.0 / 0.8.0 installs.** `core/upgrade/adopt.py`
  repairs known drift in a legacy database and then stamps the
  baseline. As part of that it applies the init files the old Helm
  chart skipped — the `HELM_SKIPS` set in that module:
  `05_case_management_extended.sql`, `28_case_closure_actor.sql`,
  `39_case_findings_finding_index.sql` and `34_drop_skills.sql` — and
  looks the files up under `database/init` inside the backend image.
  The directory is copied into that image for this reason
  (`infra/docker/Dockerfile.backend`:
  `COPY infra/database/init/ ./database/init/`).
- **Dev and test tooling.** `scripts/agent_testdb.sh` applies selected
  files to a scratch database, and
  `scripts/generate_schema_snapshot.py` applies the directory
  tolerantly when generating a schema snapshot.

Because adoption reads these files, treat edits to them as load-bearing
for legacy installs even though no fresh deployment runs them.

## Adding a schema change

Do **not** add a file here expecting a deployment to run it — nothing
on a current deploy path will. A schema change at this release is a new
revision under `core/upgrade/versions/`, chained onto the current head
via `down_revision` and applied by `python -m core.upgrade`. The code
repo's [upgrading guide](https://github.com/Vigil-SOC/vigil/blob/main/docs/upgrading.md)
is the authoritative description of that process.

## When you modify an existing init SQL file

You are changing what adoption of a 0.7.0 / 0.8.0 install applies, and
what the dev/test scripts above consume — not what a fresh install
gets. Keep the `NN_` naming convention: the directory's prefixes run
from `01_` to `47_`, and some prefixes are shared by two files (for
example the two `07_` files, `07_custom_agents.sql` and
`07_skills.sql`), so a prefix alone does not identify a file.

There is no chart bundle to keep in sync and no values list to update.
The `Helm Chart` workflow (`.github/workflows/helm-chart.yml`) still
triggers on changes under `infra/database/init/**`, but it only lints,
templates and validates the chart; its one file-parity check compares
the Bifrost config, not these SQL files.

## What this directory does *not* cover

These files are not the whole schema, and never were the only source
of tables. Within this directory, for example:

| Table | Created by |
|---|---|
| `users`, `roles` | `06_auth_tables.sql` |
| `custom_agents` | `07_custom_agents.sql` |
| `skills` | `07_skills.sql` |
| `custom_workflows` | `08_custom_workflows.sql` |
| `workflow_runs` | `12_workflow_runs.sql` |

Tables such as `cases`, `findings`, `case_evidence`, `case_tasks`,
`case_watchers` and `investigations` have no `CREATE TABLE` in this
directory. On a fresh install they are created by
`core/upgrade/versions/0001_baseline.sql`, which contains `CREATE
TABLE` statements for `public.cases`, `public.findings`,
`public.investigations` and `public.case_findings` among others.
`Base.metadata.create_all()` also still runs at app startup
(`core/storage/connection.py`).

Note that `grep`-ing for a table name in this directory is misleading:
`cases` and `findings` appear in 11 files here, but every hit is a
string literal — SLA descriptions in `05_case_management_extended.sql`,
permission JSON keys in `06_auth_tables.sql`. None of them is DDL.

## Schema drift

Adding a *column* to a model is the harder case, because `create_all`
is `checkfirst=True`: it creates missing tables and never alters
existing ones, so the column never reaches a database provisioned by an
earlier release. Startup reports this at ERROR and exposes the state
under `schema` in `/api/health` (`DB_STRICT_SCHEMA=true` makes it
fatal), but reporting is not fixing — see
[#562](https://github.com/Vigil-SOC/vigil/issues/562) for what each
deploy path actually does today.

The check compares column **names**. A changed type, a new `NOT NULL`
or a changed foreign key is drift it cannot see, so `state: ok` means
"every column the models name exists", not "the schema matches the
models".

## See also

- [Upgrading an existing install](https://github.com/Vigil-SOC/vigil/blob/main/docs/upgrading.md)
  — the code repo's guide to `python -m core.upgrade`, the baseline
  and revisions, and the 0.7.0 / 0.8.0 adoption path.
- [`.github/workflows/helm-chart.yml`](https://github.com/Vigil-SOC/vigil/blob/main/.github/workflows/helm-chart.yml)
  — the chart CI workflow, which triggers on changes under
  `infra/database/init/**`.
{% endraw %}
