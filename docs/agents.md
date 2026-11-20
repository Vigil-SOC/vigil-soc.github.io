---
layout: docs
title: "Agents"
permalink: /docs/agents/
---

{% raw %}
Specialized AI agents for different security operations tasks.

## Tool Access

All agents have access to tools through the one TypeScript agent loop
(see [Architecture](/docs/architecture/)). Tool-driven work is executed
through `core/agents/tool_registry.py`, which builds each agent's grant
from its manifest over the backend tools (`ALL_TOOLS`) plus the two
integration-door tools. There is no API-function-calling path.

### Backend Tools
- Security detections, case management, approvals, MITRE ATT&CK
- Production-ready for multi-user deployments
- Enabled by default in web UI

Built-in agents are defined by plugin manifests in `core/agents/manifests/`,
built into profiles by `core.agents.manager.profile_from_manifest`. Each
manifest's `needs:` list is the agent's tool grant.

### MCP Tools
- MCP integrations are part of the current architecture, reached from
  chat through `find_integration_tools` / `call_integration_tool`
- Vigil also ships its own MCP server (`tools/mcp/vigil.py`) and an MCP
  runner service (`services/mcp_runner/`)

> **Default Behavior**: Agents use their manifest-granted tools through the agent loop with no additional configuration needed.

## Quick Reference

| Agent | Use When |
|-------|----------|
| Triage | Prioritizing alert queue |
| Investigator | Deep-dive analysis |
| Threat Hunter | Proactive threat hunting |
| Correlator | Linking related alerts |
| Responder | Immediate action items |
| Reporter | Documentation, reports |
| MITRE Analyst | ATT&CK technique mapping |
| Forensics | Artifact analysis |
| Threat Intel | IOC enrichment |
| Compliance | Policy/regulation checks |
| Malware Analyst | Malware analysis |
| Network Analyst | Traffic analysis |
| Auto-Responder | Autonomous actions |

## Workflows

These are executable playbooks bundled in the `core/workflows/definitions/`
directory of the code repository. Each workflow is a directory containing a
`WORKFLOW.md` file with YAML frontmatter metadata and instructions.

Workflows can be executed from the **Workflows** page in the UI or via the `/api/workflows/{id}/execute` API endpoint.

| Workflow | Run Kind | Use Case | Definition |
|----------|----------|----------|------------|
| **Cloud Incident** | `investigate` | Cloud security incidents across AWS, Azure, and GCP | `core/workflows/definitions/cloud-incident/WORKFLOW.md` |
| **Forensic Analysis** | `investigate` | Post-incident forensics with chain-of-custody documentation | `core/workflows/definitions/forensic-analysis/WORKFLOW.md` |
| **Full Investigation** | `investigate` | Deep-dive analysis with ATT&CK mapping | `core/workflows/definitions/full-investigation/WORKFLOW.md` |
| **Incident Response** | `investigate` | Active incident handling | `core/workflows/definitions/incident-response/WORKFLOW.md` |
| **Root Cause Analysis** | `root_cause` | Trace a confirmed compromise back to its origin | `core/workflows/definitions/root-cause-analysis/WORKFLOW.md` |
| **Shadow Adjudication** | `adjudicate` | Shadow second opinion on a finding intake has admitted; executes nothing | `core/workflows/definitions/shadow-adjudication/WORKFLOW.md` |
| **Threat Hunt** | `hunt` | Proactive hypothesis-driven hunting | `core/workflows/definitions/threat-hunt/WORKFLOW.md` |

**Threat Hunt is not a phase chain.** It declares `run_kind: hunt`
in its frontmatter, which routes it to the hypothesis loop: the definition states
`hypotheses`, `attack_techniques` and `data_domains`, and a Hunt Lead decides each
iteration what to do next from what the evidence has done to each belief. The
shipped `hypotheses` list is empty — the caller states the hypothesis, and the
run is refused without one. The hunt logic lives in TypeScript under
`services/agent/plugins/hunt/`. Shadow Adjudication (`run_kind: adjudicate`)
uses the same hypothesis loop, with a lead framed as an adjudicator. The
remaining definitions use `run_kind: investigate`, except Root Cause Analysis,
which uses `run_kind: root_cause`.

### Adding Custom Workflows

Custom workflows are database-backed, not files on disk. Create one with
`POST /api/workflows/custom`; update it with
`PUT /api/workflows/custom/{workflow_id}` and delete it with
`DELETE /api/workflows/custom/{workflow_id}`.

Bundled definitions in `core/workflows/definitions/` are read when the
workflows service initialises. There is no reload endpoint.

## Agent Capabilities

### Triage Agent
- Rapid alert assessment
- Severity scoring
- False positive identification
- Escalation decisions

### Investigator Agent
- Root cause analysis
- Evidence collection
- Timeline reconstruction
- Cross-source correlation

### Threat Hunter Agent
- Hypothesis-driven hunting
- Anomaly detection
- Pattern recognition
- APT discovery

### Correlator Agent
- Multi-stage attack detection
- Campaign identification
- Entity relationship mapping
- Attack chain reconstruction

### Responder Agent
- Containment recommendations
- NIST IR framework
- Blast radius assessment
- Remediation steps

### Reporter Agent
- Executive summaries
- Technical reports
- Audience-tailored content
- Compliance documentation

### MITRE Analyst Agent
- Technique identification
- Kill chain analysis
- TTP mapping
- Framework contextualization
- **Detection coverage analysis**
- **Gap identification and prioritization**

### Forensics Agent
- Artifact analysis
- Chain of custody
- Multi-domain forensics
- Evidence examination

### Threat Intel Agent
- IOC enrichment
- Actor attribution
- Campaign tracking
- OSINT integration
- Cloudflare context: cites `finding.enrichment.threat_indicators` (Cloudforce One STIX hits) as ground-truth edge-observed indicators; quotes `finding.evidence.cloudy_summary` verbatim with provenance when present. MCP tools: `cf_lookup_ip_threat`, `cf_lookup_domain_threat`.

### Compliance Agent
- NIST CSF, ISO 27001, CIS Controls, PCI-DSS, HIPAA, GDPR, SOC 2
- Policy validation
- Control assessment
- Audit preparation

### Malware Analyst Agent
- Static/dynamic analysis
- Family classification
- IOC extraction
- C2 identification
- Sandbox tools: CAPE (`cape_*`), Hybrid Analysis (`ha_*`), Any.Run (`anyrun_*`), URL analysis (`url_analyze`). Agents should cache-check via `*_search_hash` before submitting new detonations.

### Network Analyst Agent
- Flow analysis
- Protocol examination
- Lateral movement detection
- Exfiltration identification
- Cloudflare context tools: `cf_lookup_ip_threat` for C2/beaconing investigations.

### Auto-Responder Agent
- Confidence-based automation
- Approval workflow integration
- Autonomous containment
- Human oversight for all actions (the approval gate requires a human decision at every confidence)
- Cloudflare enforcement: proposes `WAF_BLOCK` (cf_waf_block_ip), `GATEWAY_BLOCK` (cf_gateway_block_domain), `ACCESS_REVOKE` (cf_access_revoke_session). All cf_* write actions go through the approval pipeline in `core/response/approval_service.py`; the agent does not call them directly — the approval gate requires a human decision (see Approval Workflow Integration below).

## Approval Workflow Integration

All agents can submit actions to the approval queue. Confidence bands are
defined in `core/response/config.py` (`confidence_threshold` 0.90,
`review_threshold` 0.85, `monitor_threshold` 0.70) and are rendered into
agent prompts as routing guidance. They do not release an action: the
approval gate (`approval_requirement` in `core/response/config.py`) requires
a human decision for every approval row, whatever its confidence.

| Confidence | Behavior |
|------------|----------|
| >= 0.90 | Requires approval |
| 0.85-0.89 | Requires approval (review) |
| 0.70-0.84 | Requires approval |
| < 0.70 | Monitor only — recommendation is to keep monitoring rather than act |

## Tools Granted by Agent

Each agent's tools are the `needs:` list in its manifest under
`core/agents/manifests/`. The lists mix backend tools (the 40 in
`ALL_TOOLS`) with integration/MCP tools (for example `create_approval_action`,
the `cf_*`, `cape_*`, `ha_*`, `anyrun_*` and `vstrike_*` entries and
`shell`), which are not backend tools:

| Agent | Tools granted (manifest `needs:`) |
|-------|----------------------|
| Triage | `list_findings`, `search_findings`, `get_finding`, `create_case`, `recall_entity`, `read_skill`, `shell` |
| Investigator | `list_findings`, `search_findings`, `get_finding`, `create_approval_action`, `vstrike_ui_legend_apply`, `vstrike_ui_rightpanel_focus`, `recall_entity`, `read_skill`, `shell` |
| Threat Hunter | `list_findings`, `search_findings`, `create_approval_action`, `recall_entity`, `read_skill`, `shell` |
| Correlator | `list_findings`, `search_findings`, `create_case`, `get_technique_rollup`, `recall_entity`, `read_skill`, `shell` |
| Responder | `get_finding`, `update_case`, `create_approval_action`, `recall_entity`, `read_skill`, `shell` |
| Reporter | `list_cases`, `list_findings`, `search_findings`, `recall_entity`, `read_skill`, `list_learning_episodes`, `export_learning_episodes`, `shell` |
| MITRE Analyst | `list_findings`, `search_findings`, `get_finding`, `list_cases`, `update_case`, `get_technique_rollup`, `analyze_coverage`, `identify_gaps`, `search_detections`, `check_detection_candidate`, `save_detection_rule`, `detection_rule_exception`, `reconstruct_run`, `atomic_red_team_execute`, `telemetry_search`, `github_create_branch`, `github_create_or_update_file`, `github_create_pull_request`, `opencti_opencti_search_entities`, `opencti_opencti_get_related`, `recall_entity`, `read_skill`, `shell` |
| Forensics | `get_finding`, `recall_entity`, `read_skill`, `shell` |
| Threat Intel | `get_finding`, `list_findings`, `search_findings`, `cf_lookup_ip_threat`, `cf_lookup_domain_threat`, `check_hunt_coverage`, `propose_feed_hunts`, `recall_entity`, `read_skill`, `shell` |
| Compliance | `list_findings`, `search_findings`, `get_finding`, `list_cases`, `list_completed_hunts`, `recall_entity`, `read_skill`, `shell` |
| Malware Analyst | `get_finding`, `cape_search_hash`, `cape_submit_file`, `cape_submit_url`, `cape_get_report`, `cape_get_iocs`, `cape_task_status`, `cape_list_tasks`, `ha_search_hash`, `ha_get_report`, `anyrun_search_hash`, `anyrun_get_report`, `url_analyze`, `recall_entity`, `read_skill`, `shell` |
| Network Analyst | `list_findings`, `search_findings`, `get_finding`, `cf_lookup_ip_threat`, `cf_lookup_domain_threat`, `vstrike_network_graph_get`, `vstrike_ui_rightpanel_focus`, `recall_entity`, `read_skill`, `shell` |
| Auto-Responder | `get_finding`, `create_approval_action`, `list_approval_actions`, `cf_waf_block_ip`, `cf_waf_unblock_ip`, `cf_gateway_block_domain`, `cf_access_revoke_session`, `recall_entity`, `read_skill`, `shell` |

### External MCP Integrations

For workflows requiring external integrations (Splunk, VirusTotal, Shodan, etc.), see the MCP configuration guide in [INTEGRATIONS.md](/docs/integrations/).

### Detection Engineering Tools (Security-Detections-MCP)

Detection engineering tools are granted per manifest, not to all agents.
Of the built-in agents, only the MITRE Analyst's manifest grants the
Security-Detection family:

| Tool | Focus |
|------|-------|
| `search_detections` | Cross-platform rule search |
| `analyze_coverage` | Technique coverage analysis |
| `identify_gaps` | Gap identification |
| `check_detection_candidate` | Candidate detection checks |
| `save_detection_rule` | Rule creation |
| `detection_rule_exception` | Rule exceptions |
| `reconstruct_run` | Run reconstruction |

See [DETECTION_ENGINEERING.md](/docs/detection-engineering/) for detailed tool descriptions and workflows.

## Custom Agents

Operators can also define custom agents. Custom agents are stored in the
database (not as manifests on disk), carry `custom-`-prefixed ids, and
appear in the Agents UI alongside the built-ins above.

## Usage Tips

1. **Match agent to task** - Use the specialist for your need
2. **Switch freely** - Change agents mid-conversation
3. **Start with Triage** - When unsure where to begin
4. **End with Reporter** - Document findings
5. **Use specialist agents** - For complex analysis (Investigator, Hunter, Forensics)
6. **Use Triage or Responder** - For quick decisions
{% endraw %}
