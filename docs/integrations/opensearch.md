---
layout: docs
title: "OpenSearch"
permalink: /docs/integrations/opensearch/
---

{% raw %}
Vigil connects to **OpenSearch** over its REST API, both as a searchable
log store and as a SIEM source: with the Security Analytics plugin,
Sigma-rule detectors over centralized logs generate findings, which Vigil
ingests from the findings indices (`.opensearch-sap-*-findings-*` by
default).

## Tools

| Tool | Purpose |
|---|---|
| `opensearch_search_logs` | Search OpenSearch logs with a custom query DSL body, against a target index (default: all non-system indices) and a relative time range such as `24h` or `7d`. |
| `opensearch_search_by_ioc` | Search OpenSearch for events matching an IOC (IP, hash, username, hostname). |
| `opensearch_get_indices` | List available OpenSearch indices. |
| `opensearch_get_findings` | Fetch recent Security Analytics findings, optionally filtered by detector name. |

## Vigil configuration

Configure in **Settings → Integrations → OpenSearch**:

| Field | Notes |
|---|---|
| OpenSearch URL | Required. The OpenSearch REST endpoint. Security Analytics findings are read from the findings indices on this cluster. |
| Username / Password | Basic auth; the security plugin authenticates with basic auth. Use a user holding a read role on the findings indices. |
| OpenSearch Dashboards URL | Optional. Used only to include the Dashboards version in the connection test. |
| Findings Index Pattern | Default `.opensearch-sap-*-findings-*`. The index pattern the Security Analytics findings are read from. |
| Verify SSL Certificate | Whether to verify the server certificate. Default on (unset verifies). |
| CA Certificate Path | Optional. A PEM trusted for this integration only, in place of the default store — the private CA that signed the server certificate. Ignored when SSL verification is off. |

Settings writes these to the environment as `OPENSEARCH_OPENSEARCH_URL`,
`OPENSEARCH_DASHBOARDS_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`,
`OPENSEARCH_VERIFY_SSL`, `OPENSEARCH_INDEX_PATTERN` and
`OPENSEARCH_CA_CERT_PATH` (see `env.example`).

The MCP server stays dormant until the OpenSearch URL resolves.

## Wazuh indexer

This integration does **not** ingest Wazuh alerts: its ingestion is
Security-Analytics-findings-shaped only. Wazuh alerts are ingested as
findings by pointing the Elastic Security integration at the Wazuh
indexer. The Wazuh manager itself is covered by the separate
[Wazuh](/docs/integrations/wazuh/) integration.
{% endraw %}
