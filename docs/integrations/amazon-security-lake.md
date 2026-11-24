---
layout: docs
title: "Amazon Security Lake"
permalink: /docs/integrations/amazon-security-lake/
---

{% raw %}
Vigil queries **Amazon Security Lake** where the data sits: read-only Athena
SQL over the OCSF sources Security Lake keeps in the Glue catalogue, one
region per call. Regions, sources and OCSF versions are discovered from the
Glue catalogue shared to the query access when the server starts, and the
discovery results form part of the tool's description. Sources are found by
Security Lake naming (`amazon_security_lake_glue_db_*`,
`amazon_security_lake_table_*`); a resource link renamed away from that
naming is not found.

## Tool

| Tool | Purpose |
|---|---|
| `security_lake_query` | Run Athena (Trino) SQL naming sources by short name (not by Glue database/table name) against one AWS region, over an ISO 8601 time range (start inclusive, end exclusive). Only a single SELECT or WITH statement runs. Select `cloud.region` and `cloud.account.uid` to keep each row's provenance. A `query_id` argument instead collects the results of an earlier query in that region. |

## Vigil configuration

Configure in **Settings → Integrations → Amazon Security Lake**:

| Field | Notes |
|---|---|
| Role ARN | Optional. A role to assume for querying, from the default AWS credentials of the host the server runs on. |
| External ID | Optional. Sent when assuming the role above, if its trust policy requires one. |
| Athena Workgroup | Default `primary`. The workgroup each query runs in, by the same name in every region, with a query result output location set. |
| Regions Returning Rows | Comma-separated region codes whose result rows Vigil receives. Empty means none. |

There is no access-key field: credentials come from the default AWS chain
of the process the server runs in — an instance role, ECS task role, IRSA
or Pod Identity, or a mounted shared config named by `AWS_CONFIG_FILE` /
`AWS_SHARED_CREDENTIALS_FILE` with `AWS_PROFILE`. Under the MCP runner each
server has its own HOME, so `~/.aws` is not read. The backend runs the
Settings connection test on its own chain, so the backend and the MCP
runner must share a credential source: on Helm the same service account,
on Compose the same instance role or the same mounted config.

Under the MCP runner, a file named by a pointer variable
(`AWS_SHARED_CREDENTIALS_FILE`, `AWS_CONFIG_FILE`,
`AWS_WEB_IDENTITY_TOKEN_FILE`, and the other AWS pointer variables) is
read by the root runner and copied as the server's own uid, mode 0600,
into its own 0700 HOME, refreshed every 60 seconds; only regular files
of at most 1 MiB are copied, and paths written inside a config file are
not copied — so mount the shared config root-owned and read-only. Raw
AWS keys (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` /
`AWS_SESSION_TOKEN`) are never forwarded to any server: if the backend
resolves static keys from its own environment, the Settings connection
test says the server cannot use them and runs no discovery. On Helm the
backend chart has no matching volume hook for a shared config, so prefer
IRSA or Pod Identity there.

## Behaviour and limits

- **Allowed regions gate what Vigil receives, not what runs.** A region not
  listed in Regions Returning Rows still runs each query and answers with
  its query id, row count and bytes scanned — and no rows.
- **Athena writes every query's results** to the workgroup's output location
  in each region. That location, its lifecycle and the workgroup's
  data-scan limit are the operator's; the scan limit is the only cap on
  Athena spend.
- **Result rows are returned as Athena returns them, with no credential
  redaction applied.** A secret under any name, for example an SSM
  parameter value or EC2 user data inside CloudTrail
  `requestParameters` or `responseElements`, can reach a run.
{% endraw %}
