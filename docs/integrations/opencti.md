---
layout: docs
title: "OpenCTI"
permalink: /docs/integrations/opencti/
---

{% raw %}
Vigil reads from **OpenCTI** over its GraphQL API. The integration is
read-only: observable, indicator and entity lookups. Vigil never writes to
the platform.

## Tools

| Tool | Purpose |
|---|---|
| `opencti_search_observable` | Look up an observable (IP, domain, URL, file hash). Returns matching observables with score, labels and linked indicators; `exact_match` marks results equal to the value asked for. |
| `opencti_get_indicator` | Get one indicator: STIX pattern, validity window, score, labels, kill-chain phases. |
| `opencti_search_entities` | Search by name or alias for threat actors, intrusion sets, malware, attack patterns, tools, campaigns or reports. Attack patterns carry `x_mitre_id`, the ATT&CK technique id. |
| `opencti_get_related` | List the relationships going out of an entity (uses, targets, attributed-to, …). For a report (or grouping, case) it also lists the objects the report names. |

## Vigil configuration

Configure in **Settings → Integrations → OpenCTI**:

| Field | Notes |
|---|---|
| OpenCTI Platform URL | Required. The platform's base URL; Vigil calls `/graphql` on it. |
| API Token | Required. From your OpenCTI profile. A user with read access (Knowledge and Observables) is enough. |
| Verify SSL Certificate | Default on. |
| CA Certificate Path | Optional. A PEM trusted for this integration only, in place of the default store — the private CA that signed the server certificate. Ignored when SSL verification is off. |

Settings writes these to the environment as `OPENCTI_URL`,
`OPENCTI_API_TOKEN`, `OPENCTI_VERIFY_SSL` and `OPENCTI_CA_CERT_PATH`
(see `env.example`).

The MCP server stays dormant until the URL and token resolve; calls made
before then return an "OpenCTI not configured" error naming the missing
fields.

## Security

- Keep **Verify SSL Certificate** on for any server you do not control:
  with verification skipped, the API token is sent to whoever answers at
  the configured URL.
{% endraw %}
