---
layout: docs
title: "Wazuh"
permalink: /docs/integrations/wazuh/
---

{% raw %}
Vigil reads from the **Wazuh manager's server API** (port 55000). The
integration is read-only: loaded rules, agents and their log collection,
and logtest of a sample event against the ruleset.

Alerts do **not** come through this integration. Wazuh alerts are ingested
by pointing the Elastic Security or [OpenSearch](/docs/integrations/opensearch/)
integration at the Wazuh indexer (`wazuh-alerts-4.x-*`).

## Tools

| Tool | Purpose |
|---|---|
| `wazuh_list_rules` | List the rules loaded on the manager: id, level, description, groups, `if_sid` / `if_matched_sid` parents, MITRE technique ids, file and status. Filterable by rule ids, level (a level or a range such as `7-15`), group, free-text search and status. Returns every matching rule, not a page. |
| `wazuh_list_agents` | List Wazuh agents (id, name, status, groups, OS). Agent `000` is the manager. |
| `wazuh_agent_log_collection` | Read one agent's active log collection: its logcollector localfile entries (files, commands, event channels and formats). |
| `wazuh_test_event` | Run a sample log line through the manager's ruleset (logtest) and report which rule matched, its level, the decoder, and the full output. Nothing is stored; the logtest session is closed afterwards. |

## Vigil configuration

Configure in **Settings → Integrations → Wazuh**:

| Field | Notes |
|---|---|
| Manager API URL | Required. The manager's server API, port 55000 by default — not the indexer or the dashboard. |
| Username | Required. A Wazuh API user with read access to rules, agents and logtest. |
| Password | Required. |
| Verify SSL Certificate | Default on. |
| CA Certificate Path | Optional. A PEM trusted for this integration only, in place of the default store — the private CA that signed the server certificate. Ignored when SSL verification is off. |

Settings writes these to the environment as `WAZUH_API_URL`,
`WAZUH_USERNAME`, `WAZUH_PASSWORD`, `WAZUH_VERIFY_SSL` and
`WAZUH_CA_CERT_PATH` (see `env.example`).

The MCP server stays dormant until the API URL, username and password
resolve.

## Security

- Keep **Verify SSL Certificate** on for any server you do not control:
  with verification skipped, the API password is sent to whoever answers
  at the configured URL.
{% endraw %}
