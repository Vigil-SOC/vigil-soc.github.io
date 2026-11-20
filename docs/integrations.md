---
layout: docs
title: "Integrations"
permalink: /docs/integrations/
---

{% raw %}
Configure integrations via **Settings > Integrations** in the web UI.

## Backend Tools (in-process)

Backend tools are defined in-process in `core/llm/tool_schemas.py` and
served alongside MCP. There is no separate agent SDK layer.

### Available Backend Tools

The lists in `core/llm/tool_schemas.py` (`ALL_TOOLS`) cover:

| Category | Tools |
|----------|-------|
| **Security Detections** | Coverage analysis, detection search, gap identification |
| **Findings & Cases** | List/get findings, case management, similarity search |
| **MITRE ATT&CK** | Technique rollup (`get_technique_rollup`) |
| **Threat Intel** | Threat intelligence lookups |
| **Approval Workflow** | Pending approvals, approve/reject actions, statistics |
| **Memory** | Memory recall and storage |
| **Skill** | Skill execution |

Access to connected integrations goes through two additional tools that
are deliberately kept out of `ALL_TOOLS`: `find_integration_tools` and
`call_integration_tool` (`INTEGRATION_TOOLS` in
`core/llm/tool_schemas.py`).

### Benefits

- ✅ **Web UI Compatible** - All tools accessible via browser
- ✅ **Production Ready** - Multi-user deployments
- ✅ **In-process** - Backend tools run in-process, with no separate desktop app

### Usage

Backend tools are automatically enabled for web UI users. See [Backend Tools Guide](/docs/backend-tools/) for detailed documentation.

## MCP Servers (Optional - Advanced Integration)

> **Note**: MCP servers are optional and primarily used for advanced integrations requiring external services (Splunk, VirusTotal, etc.). Web UI users get full functionality through the in-process backend tools described above.

Each connector in `mcp-config.json` is checked weekly by the [live connector checks](/docs/github-workflows/#5-connectors-liveyml---live-connector-checks); connectors without a configured live instance report "no live check" rather than a result against a real instance.
{% endraw %}
{% assign matrix = site.data.connector_matrix %}
{% assign rows = matrix.connectors | sort: "server" %}
{% assign passed = rows | where: "status", "pass" %}
{% assign untested = rows | where_exp: "c", "c.status != 'pass'" | where_exp: "c", "c.status != 'fail'" %}
{% assign failed = rows | where: "status", "fail" %}
Checked on {{ matrix.ran_at | date: "%B %-d, %Y" }} at commit `{{ matrix.commit }}` ([run]({{ matrix.run }})).

> Note: this table is generated from the snapshot above, which predates the current release; it does not yet include every configured connector (for example, `amazon-security-lake` is missing from this snapshot).

| Connector | Version | Live result |
|-----------|---------|-------------|
{% for c in passed %}| {{ c.server }} | {{ c.version }} | ✅ Passed |
{% endfor %}{% for c in untested %}| {{ c.server }} | {{ c.version }} | — Not tested |
{% endfor %}{% for c in failed %}| {{ c.server }} | {{ c.version }} | ❌ Failed |
{% endfor %}{: .connector-matrix}
{% raw %}

## Security-Detections-MCP

Detection engineering with 7,200+ rules across Sigma, Splunk ESCU, Elastic, and KQL formats.

### Overview

Security-Detections-MCP provides:
- **7,200+ Detection Rules** - Comprehensive detection rule database
- **Detection Tools** - Coverage analysis, gap identification, template generation
- **Expert Prompts** - Guided detection engineering workflows
- **Tribal Knowledge** - Document and retrieve detection decisions
- **Pattern Intelligence** - Learn from existing detection rules

The tool categories and expert prompts below describe the external
`security-detections-mcp` server configured in `mcp-config.json`; they
are not defined in this repository and cannot be verified from it. The
7,200+ rules figure matches `setup_dev.sh` (~7,200 rules, ~4GB).

### Configuration

Detection repositories are **off by default** during `./setup_dev.sh`
and are opt-in only, because the download is heavy (~7,200 rules, ~4GB).
To enable them, run setup with the opt-in flag:

```bash
SETUP_DETECTION_REPOS=1 ./setup_dev.sh
```

When enabled, detection repositories are cloned to `~/security-detections/`.

To update repositories:
```bash
./scripts/setup_detection_repos.sh --update
```

### Key Tool Categories

| Category | Focus | Description |
|----------|-------|-------------|
| Coverage Analysis | Techniques & gaps | Quantify detection coverage by MITRE technique |
| Detection Search | Cross-source query | Find relevant detection rules |
| Pattern Intelligence | Rule learning | Learn from existing detection patterns |
| Template Generation | Creation & conversion | AI-assisted detection rule creation |
| Tribal Knowledge | Institutional memory | Document and retrieve detection decisions |
| Analytics & Reporting | Metrics & posture | Metrics and gap analysis reports |

### Expert Workflow Prompts

Guided workflows for detection engineering:
- `apt-threat-emulation` - Purple team exercises for APT groups
- `coverage-analysis` - Comprehensive coverage assessment
- `detection-tuning` - Optimize existing detections
- `gap-prioritization` - Prioritize detection gaps
- `mitre-mapping` - Map findings to ATT&CK framework
- `purple-team-report` - Generate purple team reports
- `threat-landscape-sync` - Align to current threat landscape
- `detection-validation` - Validate detection effectiveness
- `sigma-to-platform` - Convert Sigma to platform-specific
- `coverage-heatmap` - Visualize detection coverage
- `detection-lifecycle` - Manage detection lifecycle

### Primary Use Cases

**For MITRE Analyst Agent:**
```
"What's our detection coverage for APT29?"
"What detection gaps exist for ransomware?"
"Generate a Splunk detection for T1059.001 PowerShell execution"
```

**For Threat Hunter Agent:**
```
"What patterns exist for detecting C2 beaconing?"
"Extract common fields used in PowerShell detections"
"Show me similar detections to the one we just created"
```

**For Investigator Agent:**
```
"Would our current detections catch this attack?"
"What detections exist for technique T1071.001?"
"Document why we prioritized this detection"
```

### Documentation

See [DETECTION_ENGINEERING.md](/docs/detection-engineering/) for complete usage guide, examples, and best practices.

## Splunk

Natural language to SPL query generation.

Vigil has two Splunk entries in `mcp-config.json`: `splunk`, the
external Splunk Official MCP server reached via `mcp-remote`, and
`splunk-selfhosted`, the in-repo server in
`core/integrations/splunk/tool.py`. The tool table below is the in-repo
self-hosted server's table.

### Configuration

```bash
SPLUNK_PASSWORD="your_password"
```

Settings > Integrations > Splunk:
- Server URL: `https://splunk.example.com:8089`
- Username
- Password
- Verify SSL
- CA Certificate Path

### MCP Tools (in-repo `splunk-selfhosted`)

| Tool | Description |
|------|-------------|
| `splunk_generate_spl` | Natural language to SPL |
| `splunk_execute` | Run SPL query |
| `splunk_search_ip` | Quick IP search |
| `splunk_search_host` | Quick hostname search |
| `splunk_nl_search` | Generate and execute |

The in-repo server has no tool for listing indexes.

Searches here only read. Any SPL containing a side-effecting command —
in a pipe stage or a subsearch — is refused, including `delete`,
`collect`, `summaryindex`, `mcollect`, `meventcollect`, `tscollect`,
`outputlookup`, `outputcsv`, `outputtext`, `outputtelemetry`,
`sendemail`, `sendalert`, `script`, `run`, `runshellscript`, `dump`,
`map`, `fit`, `dbxoutput` and `dbxquery`. The refusal reads:
"Refused: '<command>' can change Splunk or send data out; searches here
only read". This applies to both `splunk_execute` and `splunk_nl_search`.

## Elastic Security

Elasticsearch SIEM with detection alert ingestion and IOC enrichment.

### Configuration

```bash
ELASTIC_SIEM_ELASTICSEARCH_URL="https://elasticsearch.example.com:9200"
ELASTIC_SIEM_KIBANA_URL="https://kibana.example.com:5601"
ELASTIC_SIEM_API_KEY="your_api_key"
# Or use basic auth:
# ELASTIC_SIEM_USERNAME="elastic"
# ELASTIC_SIEM_PASSWORD="your_password"
```

Settings > Integrations > Elastic Security (SIEM):
- Elasticsearch URL (the only required field; the UI id for this
  integration is `elastic-siem`, while the MCP server is `elastic`)
- Kibana URL (required only for Kibana Security API calls; alert
  ingestion without a Kibana URL reads the configured index pattern
  directly)
- API Key or Username/Password
- Alert Index Pattern (default: `.alerts-security.alerts-default`)

### MCP Tools

| Tool | Description |
|------|-------------|
| `elastic_search_logs` | Search Elasticsearch with query DSL |
| `elastic_search_by_ioc` | Search by IOC (IP, hash, username, hostname) |
| `elastic_get_indices` | List available indices |
| `elastic_get_detection_alerts` | Fetch recent detection alerts |

### Features

- **Alert Ingestion**: Daemon poller fetches detection alerts from Kibana Detections API
- **IOC Enrichment**: Agents query Elasticsearch indices for logs matching case IOCs

## Timesketch (no integration at this version)

There is no Timesketch integration at this version: there is no
`timesketch` entry in `mcp-config.json`, no slice under
`core/integrations/`, and no Timesketch entry in the web UI integrations
catalog. The only counterpart in code is a storage model,
`SketchMapping` in `core/storage/models/config.py`, which links
cases/findings to Timesketch sketches. No Timesketch MCP tools are
available.

## Threat Intelligence

### VirusTotal

```bash
# Settings > Integrations > VirusTotal
VIRUSTOTAL_API_KEY="your_api_key"
```

VirusTotal is descriptor-only in-repo (no `tool.py`); it is served by
the external server configured in `mcp-config.json`.

Tools: `vt_check_hash`, `vt_check_ip`, `vt_check_domain`, `vt_check_url`

### Shodan

```bash
SHODAN_API_KEY="your_api_key"
```

Shodan is descriptor-only in-repo; the tools below are the external
server's names.

Tools: `shodan_search_ip`, `shodan_get_host_info`, `shodan_search_exploits`

### AlienVault OTX

```bash
ALIENVAULT_OTX_API_KEY="your_api_key"
```

Tools: `otx_check_ip`, `otx_check_domain`, `otx_check_hash`

### MISP

```bash
MISP_URL="https://misp.example.com"
MISP_API_KEY="your_api_key"
```

Tools: `misp_search_ioc`, `misp_get_events`

### Cloudflare Cloudforce One (STIX/TAXII)

Pulls Cloudflare's Cloudforce One threat feed via TAXII 2.1 into the
`threat_indicators` table. The daemon polls on the configured interval; the
finding processor enriches IOCs against this table and surfaces matches
under `finding.enrichment.threat_indicators`.

```bash
# Settings → Integrations → Cloudflare Cloudforce One
# (env vars are fallbacks; the integration is the on/off switch)
CLOUDFORCE_ONE_API_TOKEN="..."
CLOUDFORCE_ONE_TAXII_SERVER_URL="https://api.cloudflare.com/client/v4/accounts/{account_id}/cloudforce-one/threat-events/taxii2/"
CLOUDFORCE_ONE_COLLECTION_IDS="collection-uuid-1,collection-uuid-2"
THREAT_FEED_POLL_INTERVAL="900"
```

Operates independently of the Cloudflare WAF/Zero Trust integration —
customers can subscribe to either or both. Cloudforce One has no MCP
server and no vendor slice: it is a daemon poller configured from the
Settings UI.

## Darktrace

Darktrace is a push-only webhook integration (no MCP server). It has its
own page: [Darktrace](/docs/integrations/darktrace/).

## Sandbox Analysis

### Hybrid Analysis

```bash
HYBRID_ANALYSIS_API_KEY="your_api_key"
```

Tools: `ha_search_hash`, `ha_get_report`

### Joe Sandbox

```bash
JOE_SANDBOX_API_KEY="your_api_key"
```

Joe Sandbox has no in-repo `tool.py` (descriptor only in
`core/integrations/joe_sandbox/`); it is served by the external server
configured in `mcp-config.json`, so no in-repo tool names are listed
here.

### ANY.RUN

```bash
ANYRUN_API_KEY="your_api_key"
```

Tools: `anyrun_get_report`, `anyrun_search_hash`

### CAPE Sandbox

Open-source Cuckoo fork for on-prem detonation. Vigil ships an MCP client
(`core/integrations/cape_sandbox/tool.py`) that talks to an existing CAPE deployment over
its REST API — Vigil does **not** host CAPE itself. CAPE requires KVM and
Windows guest VMs, so it's typically deployed on bare metal, not inside
Docker Desktop.

```bash
CAPE_SANDBOX_ENABLED="true"
# Default in env.example is http://localhost:8000; the value below is an
# example deployment value for an internal CAPE host.
CAPE_SANDBOX_URL="http://cape.internal:8000"
CAPE_SANDBOX_API_KEY="your_cape_api_token"
```

Tools: `cape_submit_file`, `cape_submit_url`, `cape_get_report`,
`cape_get_iocs`, `cape_get_pcap`, `cape_list_tasks`, `cape_search_hash`,
`cape_task_status`.

### Auto-submission pipeline

When `SANDBOX_AUTO_SUBMIT=true` and at least one sandbox is enabled, the
daemon will, during finding enrichment, consult each sandbox's hash cache
for any file hash on the finding. Safety gates:

- File extension must be in `SANDBOX_ALLOWED_FILE_TYPES` (default list
  matches common malware extensions).
- `file_size` (when known) must be ≤ `SANDBOX_MAX_FILE_SIZE_MB`.
- No binary bytes are ever sent from Vigil. Only hash-cache lookups and
  sandbox-API submission-by-hash are performed.

A companion scheduler task (`sandbox_poll`, default every 60s) picks up
completed reports and writes them into the case as `CaseEvidence` plus
extracted IOCs into `CaseIOC`. See [SANDBOX.md](/docs/sandbox/).

## Network Security & Edge Enforcement

### Cloudflare (WAF, Zero Trust Gateway, Access)

Closes the loop by letting Vigil propose and (with approval) execute
enforcement actions on Cloudflare's edge:

| Action type | MCP tool | Cloudflare API |
|---|---|---|
| `WAF_BLOCK` | `cf_waf_block_ip` / `cf_waf_unblock_ip` | IP Access Rules (`/firewall/access_rules/rules`) |
| `GATEWAY_BLOCK` | `cf_gateway_block_domain` | Zero Trust Gateway DNS+HTTP rule (`/gateway/rules`) |
| `ACCESS_REVOKE` | `cf_access_revoke_session` | Access organization revoke (`/access/organizations/revoke_user`) |

Read-only context tools — `cf_lookup_ip_threat` and `cf_lookup_domain_threat`
— are wired into the Threat Intel and Network Analyst agents so investigations
can pull edge context on demand.

```bash
# Settings → Integrations → Cloudflare
# Required scopes: Zone:Firewall Services:Edit, Account:Zero Trust:Edit,
#                  Account:Access:Edit, Account:Account Analytics:Read
CLOUDFLARE_API_TOKEN="..."
CLOUDFLARE_ACCOUNT_ID="..."   # required for Zero Trust + Access actions
CLOUDFLARE_ZONE_ID="..."      # optional default zone for WAF rules
```

All write actions route through `core/response/approval_service.py`. No
confidence band auto-approves them: an analyst must approve in the Approvals
UI before the daemon executes the call (confidence thresholds are routing
bands only).

### Cloudflare Cloudy ingestion (gated)

Inbound webhook receiver at `POST /api/webhooks/cloudflare/cloudy` for
Cloudflare-pushed events with attached Cloudy natural-language summaries.
**Off by default** because the upstream contract is not publicly stable
yet; the router only mounts when `CLOUDY_INGESTION_ENABLED=true` and a
`CLOUDY_WEBHOOK_SECRET` is set for HMAC-SHA256 verification.

When enabled, Cloudy summaries land on findings as
`finding.evidence.cloudy_summary` (cited verbatim, with provenance) and
are surfaced into the Threat Intel agent's context window.

### CrowdStrike

CrowdStrike is the external `falcon-mcp` server in `mcp-config.json`;
there is no in-repo `tool.py` for it (descriptor only in
`core/integrations/crowdstrike/`), so its tool names are the external
server's and are not listed here.

```bash
# Env names read by the MCP server entry in mcp-config.json:
FALCON_CLIENT_ID="your_client_id"
FALCON_CLIENT_SECRET="your_client_secret"
FALCON_BASE_URL="https://api.crowdstrike.com"
# env.example uses CROWDSTRIKE_CLIENT_ID / CROWDSTRIKE_CLIENT_SECRET.
```

## Communication

### Slack

```bash
SLACK_BOT_TOKEN="xoxb-..."
SLACK_DEFAULT_CHANNEL="#soc-alerts"
```

The in-repo server (`core/integrations/slack/tool.py`) exposes one tool:

Tools: `slack_send_alert`

### Jira

Jira is covered by the hosted Atlassian Rovo MCP server in
`mcp-config.json` (reached via `mcp-remote`, OAuth 2.1 browser flow).
It is descriptor-only in-repo (no `tool.py`), so its tool names are the
hosted server's and are not Vigil-defined; no `JIRA_URL` / `JIRA_EMAIL` /
`JIRA_API_TOKEN` env block applies to that OAuth wiring.

## Data Pipeline

### Cribl Stream

```bash
CRIBL_BASE_URL="..."
CRIBL_AUTH_TYPE="cloud"
CRIBL_CLIENT_ID="..."
CRIBL_CLIENT_SECRET="..."
CRIBL_USERNAME="..."
CRIBL_PASSWORD="your_password"
```

Benefits:
- Normalize log formats before DeepTempo analysis
- Filter noise before downstream ingestion
- Enrich events with GeoIP, asset info
- Route data to multiple destinations

```
Data Sources -> Cribl Stream -> DeepTempo LogLM
                            -> Splunk
                            -> S3/Data Lake
```

## Additional Connectors

The connectors below are configured via **Settings > Integrations**
and named as MCP servers in `mcp-config.json`. Each entry notes whether
Vigil ships an in-repo slice for it under `core/integrations/`.

### Amazon Security Lake

MCP server `amazon-security-lake`. Full in-repo slice:
`core/integrations/amazon_security_lake/` (`tool.py`, `descriptor.py`,
`lake.py`). Also listed in the web UI integrations catalog.
See [Amazon Security Lake](/docs/integrations/amazon-security-lake/).

### Atomic Red Team

MCP server `atomic-red-team`. In-repo slice:
`core/integrations/atomic_red_team/` (`tool.py`, `descriptor.py`).
Also listed in the web UI integrations catalog.

### AWS Security Hub

MCP server `aws-security` in `mcp-config.json`; the descriptor and web
UI catalog use the name `aws-security-hub`
(`core/integrations/aws_security_hub/`, descriptor only — no `tool.py`).

### Azure AD

MCP server `azure-ad`. In-repo slice: `core/integrations/azure_ad/`
(`tool.py`, `descriptor.py`). Also listed in the web UI integrations
catalog.

### Azure Sentinel

MCP server `azure-sentinel` (hosted). Descriptor only in
`core/integrations/azure_sentinel/` — no `tool.py`. Also listed in the
web UI integrations catalog.

### Carbon Black

MCP server `carbon-black`. In-repo slice:
`core/integrations/carbon_black/` (`tool.py`, `descriptor.py`). Also
listed in the web UI integrations catalog.

### Firecrawl

MCP server `firecrawl`. No in-repo descriptor directory or slice; also
listed in the web UI integrations catalog.

### GCP Security Command Center

MCP server `gcp-scc`. MCP-only connector: no in-repo descriptor
directory and no web UI catalog entry.

### GCP Security Operations

MCP server `gcp-secops`. No in-repo descriptor directory or slice; also
listed in the web UI integrations catalog as `gcp-secops`.

### GCP Threat Intelligence

MCP server `gcp-threat-intel`. No in-repo descriptor directory or
slice; also listed in the web UI integrations catalog as
`gcp-threat-intel`.

### GitHub

MCP server `github`. No in-repo descriptor directory or slice; also
listed in the web UI integrations catalog as `github`.

### IP Geolocation

MCP server `ip-geolocation`. In-repo slice:
`core/integrations/ip_geolocation/` (`tool.py`, `descriptor.py`). Also
listed in the web UI integrations catalog.

### DeepTempo LogLM

MCP server `loglm` (hosted). No in-repo descriptor directory or slice;
also listed in the web UI integrations catalog as `loglm`.

### Microsoft Defender

MCP server `microsoft-defender`. In-repo slice:
`core/integrations/microsoft_defender/` (`tool.py`, `descriptor.py`,
plus adapter/ingestion code). Also listed in the web UI integrations
catalog.

### Microsoft Teams

MCP server `microsoft-teams`. In-repo slice:
`core/integrations/microsoft_teams/` (`tool.py`, `descriptor.py`).
Also listed in the web UI integrations catalog.

### Okta

MCP server `okta`. Descriptor only in `core/integrations/okta/` — no
`tool.py`. Also listed in the web UI integrations catalog.

### OpenCTI

MCP server `opencti`. Full in-repo slice:
`core/integrations/opencti/` (`tool.py`, `descriptor.py`, `client.py`).
Also listed in the web UI integrations catalog.
See [OpenCTI](/docs/integrations/opencti/).

### OpenSearch

MCP server `opensearch`. Full in-repo slice:
`core/integrations/opensearch/` (`tool.py`, `descriptor.py`, plus
adapter/client/ingestion code). Also listed in the web UI integrations
catalog. See [OpenSearch](/docs/integrations/opensearch/).

### PagerDuty

MCP server `pagerduty`. Descriptor only in
`core/integrations/pagerduty/` — no `tool.py`. Also listed in the web
UI integrations catalog.

### Palo Alto

MCP server `palo-alto`. In-repo slice:
`core/integrations/palo_alto/` (`tool.py`, `descriptor.py`). Also
listed in the web UI integrations catalog.

### SentinelOne

MCP server `sentinelone`. Descriptor only in
`core/integrations/sentinelone/` — no `tool.py`. Also listed in the web
UI integrations catalog.

### URL Analysis

MCP server `url-analysis`. In-repo slice:
`core/integrations/url_analysis/` (`tool.py`, `descriptor.py`). Also
listed in the web UI integrations catalog.

### Wazuh

MCP server `wazuh`. Full in-repo slice: `core/integrations/wazuh/`
(`tool.py`, `descriptor.py`, `client.py`). Also listed in the web UI
integrations catalog. See [Wazuh](/docs/integrations/wazuh/).

## Adding Custom Integrations

Settings > Integrations > Custom Integration Builder:

1. Upload API documentation
2. AI generates MCP server code
3. Review and test
4. Saved to `~/.vigil/custom_integrations/<id>_server.py`

> **Not running:** Vigil does not start saved custom integrations, so its tools do not reach chat or agents. Saving an integration does not start it, and setting it up under Integrations does not either — the saved server file is not run by Vigil.

## CloudCurrent VStrike (Network Topology Fusion)

VStrike enriches DeepTempo findings with network topology, asset, segment,
and mission-system context, then pushes the enriched findings back into
Vigil. Vigil can also query VStrike on demand for asset topology and blast
radius.

### Integration surface

Vigil exposes exactly three VStrike REST routes
(`services/api/routers/vstrike.py`). All other VStrike operations are
MCP tools in `core/integrations/vstrike/tool.py` only — they are not
REST routes.

REST routes:

| Direction | Endpoint | Purpose |
|-----------|----------|---------|
| VStrike → Vigil | `POST /api/integrations/vstrike/findings` | Push enriched findings (batched) |
| Vigil → VStrike | `GET /api/integrations/vstrike/health` | Outbound reachability check |
| Vigil → VStrike | `GET /api/integrations/vstrike/topology/asset/{asset_id}` | Asset topology lookup |

MCP tools (`core/integrations/vstrike/tool.py`):

| Tool | Purpose |
|------|---------|
| `vstrike_get_asset_topology` | Asset topology lookup |
| `vstrike_list_adjacent_assets` | One-hop neighbors |
| `vstrike_get_blast_radius` | Blast radius |
| `vstrike_get_segment_findings` | Findings by segment |
| `vstrike_node_search` | Node search |
| `vstrike_node_drift_get` | Node drift |
| `vstrike_storyline_list` | List storylines |
| `vstrike_storyline_events_get` | Storyline events |
| `vstrike_legend_run_list` | List legend runs |
| `vstrike_legend_run_results_get` | Legend run results |
| `vstrike_network_graph_get` | Full network graph: `{label, nodes, edges, bbox}` |
| `vstrike_ui_legend_apply` | Apply selected legend in the iframe |
| `vstrike_ui_rightpanel_focus` | Open / focus the iframe's right-hand details panel |

#### MCP-only UI and graph tools

| Tool | Input | Behavior |
|------|-------|----------|
| `vstrike_network_graph_get` | `networkId` (optional) | Returns `{label, nodes, edges, bbox}` for the active (or specified) network. Useful for blast-radius, path-finding, and layout reasoning beyond single-asset lookups. |
| `vstrike_ui_legend_apply` | `legendId` (required, value from `legend-run-list`), `networkId` (optional) | Applies the selected legend run inside the active VStrike iframe session. |
| `vstrike_ui_rightpanel_focus` | none | Opens the VStrike iframe's right-hand details panel for whatever node is currently selected. |

These are MCP tools only; there are no corresponding Vigil REST routes
for adjacent assets, blast radius, network graph, legend apply, or
right-panel focus.

Service methods accept `**kwargs` and REST routes use `extra="allow"` Pydantic models, so future schema bumps on VStrike's side don't require a Vigil refactor.

### Configuration

Either set env vars (recommended for push/CI) or configure via the UI:

```bash
# .env
VSTRIKE_BASE_URL="https://vstrike.example.com"
VSTRIKE_API_KEY="<outbound bearer token>"
VSTRIKE_VERIFY_SSL="true"
VSTRIKE_INBOUND_API_KEY="<bearer token Vigil expects on inbound push>"
```

UI: **Settings → Integrations → CloudCurrent VStrike**.

### Storage model

VStrike enrichment lives at `finding.entity_context["vstrike"]` (JSONB —
no DB migration required). Shape is defined by
`core/integrations/vstrike/schemas.py::VStrikeEnrichment`.

The ingest handler does read-modify-write on `entity_context` so existing
keys (`src_ip`, `hostname`, etc.) are never clobbered.

### Auto-case clustering

When `auto_cluster_cases: true` (default), the ingest handler groups
upserted findings by `(segment, attack_path[0] or asset_id)` and creates
one case per group via
`core.cases.case_automation_service.cluster_findings_by_attack_path`.

### Authentication

Inbound push uses a bearer token:

```
Authorization: Bearer $VSTRIKE_INBOUND_API_KEY
```

When `DEV_MODE=true`, the auth check is bypassed (matches the rest of the
codebase). Outside dev mode, the endpoint returns:
- `401` if the header is missing or wrong
- `503` if `VSTRIKE_INBOUND_API_KEY` is unset (refuses to run open)

### Example push

```bash
export DEV_MODE=true
curl -X POST http://localhost:6987/api/integrations/vstrike/findings \
  -H 'Content-Type: application/json' \
  -d '{
    "batch_id": "demo-1",
    "findings": [{
      "finding_id": "f-test-1",
      "timestamp": "2026-05-20T14:00:00Z",
      "anomaly_score": 0.87,
      "vstrike_enrichment": {
        "asset_id": "srv-01",
        "asset_name": "SAP-PROD-01",
        "segment": "mgmt-vlan-10",
        "site": "JBSA",
        "criticality": "high",
        "mission_system": "C2-AWACS",
        "attack_path": ["ext-gw-01", "dmz-web-02", "srv-01"],
        "blast_radius": 14,
        "adjacent_assets": [
          {"asset_id": "dc-01", "hop_distance": 1, "edge_technique": "T1021.002"}
        ],
        "enriched_at": "2026-05-20T14:00:00Z"
      }
    }]
  }'
```

### Visualization

The embedded VStrike `NetworkContextPanel` is deliberately not ported
to the web UI: `clients/web/src/screens/dashboard/FindingPopup.tsx`
notes it needs the VStrike provider, which isn't mounted under the
console shell. There is no `Investigation.tsx`, `EntityGraph`, or
`vstrike-graph-highlight` wiring in the web UI at this version. The
`vstrike_ui_*` MCP tools above exist as agent-invokable tools only;
treat any in-UI graph highlighting or panel rendering as planned, not
shipped.

### Testing

There are no VStrike tests in the repository at this version (no test
file under `tests/` references VStrike), so there are no VStrike test
commands to run.
{% endraw %}
