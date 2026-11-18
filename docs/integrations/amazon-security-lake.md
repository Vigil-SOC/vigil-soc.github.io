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
| `security_lake_query` | Run Athena (Trino) SQL naming sources by short name against one AWS region, over an ISO 8601 time range (start inclusive, end exclusive). A `query_id` argument instead collects the results of an earlier query in that region. |

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

## Behaviour and limits

- **Allowed regions gate what Vigil receives, not what runs.** A region not
  listed in Regions Returning Rows still runs each query and answers with
  its query id, row count and bytes scanned — and no rows.
- **Athena writes every query's results** to the workgroup's output location
  in each region. That location, its lifecycle and the workgroup's
  data-scan limit are the operator's; the scan limit is the only cap on
  Athena spend.
- **Result rows pass Vigil's credential redaction**, which masks known
  credential field names (such as `password`, `secretAccessKey`,
  `sessionToken`) and token shapes only. A secret under any other name —
  for example an SSM parameter value or EC2 user data inside CloudTrail
  `requestParameters` or `responseElements` — can reach a run.
{% endraw %}
