---
layout: docs
title: "Detection Engineering"
permalink: /docs/detection-engineering/
---

{% raw %}
Detection engineering in Vigil covers MITRE ATT&CK coverage analysis, detection-rule search, and drafting and saving new rules. It is provided by local backend tools, by a detection surface on Vigil's own MCP server (`/mcp`) for external callers, plus an optional MCP server (`security-detections`) for the external rule repositories.

## Overview

Detection engineering features:
- **Backend detection tools** for coverage analysis, gap identification, detection search, rule linting, and saving drafted rules to Vigil's own overlay
- **External rule repositories** — Sigma, Splunk ESCU, Elastic, and KQL formats — fetched only on opt-in (see Quick Start)
- **MITRE ATT&CK Integration** - Map detections to techniques

### Implementation

**Backend tools (default)**: The local detection tools listed below are part of Vigil's backend tool set. Access is permission-gated: read tools require `detections.read` and write tools require `detections.write`.

Coverage and search over the external repositories return empty until those repositories have been fetched; the fetch is off by default (see Quick Start).

**MCP Server (optional)**: The `security-detections` server in `mcp-config.json` runs the pinned `security-detections-mcp@3.3.4` package against the fetched repositories. Its tools and workflow prompts are provided by that upstream package and are not enumerated in the Vigil code repository, so they are not catalogued here. This is a separate surface from Vigil's own MCP server, whose detection tools are catalogued under [Detection over MCP](#detection-over-mcp-vigils-own-server) below.

## Quick Start

### Installation

The detection repositories are heavy (approximately 7,200 rules, ~4GB, per `setup_dev.sh` and `scripts/setup_detection_repos.sh`) and are **off by default**. Opt in during setup:

```bash
SETUP_DETECTION_REPOS=1 ./setup_dev.sh
```

Skipping the fetch is the default, so a plain `./setup_dev.sh` does not clone them.

To fetch or update the repositories directly:
```bash
./scripts/setup_detection_repos.sh

# Update existing repositories
./scripts/setup_detection_repos.sh --update
```

The script clones four repositories, each with `--depth 1`, under `~/security-detections/`:
- `sigma` — Sigma rules
- `security_content` — Splunk ESCU content
- `detection-rules` — Elastic rules
- `Hunting-Queries-Detection-Rules` — KQL queries

### Verify Installation

```bash
# Check the repositories exist
ls -l ~/security-detections/

# Check MCP server status via the API
GET /api/mcp/servers/status
```

## Local Backend Detection Tools

Vigil provides 12 local backend detection tools, defined in `core/llm/tool_schemas.py` (SECURITY_DETECTION_TOOLS) and implemented in `core/detections/tools.py`:

| Tool | Permission | Description |
|------|------------|-------------|
| `analyze_coverage` | `detections.read` | Analyze detection coverage for MITRE ATT&CK techniques: catalog counts by format (Sigma / Splunk / Elastic / KQL), per-SIEM rule checks for SIEM rules, or per-technique verdicts for a run passed by `run_id` or as action-trace steps |
| `search_detections` | `detections.read` | Keyword search across the configured repositories, Vigil's overlay of drafted rules, and the rules run by Kibana, Splunk, and Wazuh, with filters such as `source_type`, `tool`, and rule-check results |
| `link_detection_rule` | `detections.write` | Record which repo rule a SIEM rule (a copy in Kibana or Splunk) came from: `link`, `decline`, or `unlink` a copy's origin. Every call is written to the audit log with the actor and reason |
| `identify_gaps` | `detections.read` | Compare the ATT&CK techniques seen on stored alerts with the detection rules actually loaded and list techniques no rule declares, including blind spots (data sources with no recent events) and rule-health flags. Also reports `runs_rules_missed` — proven hunts and closed Cases no rule alerted on — and `rule_health` (Runs / Sees / Quiet / Noisy / Silent and drift pass→fail flags). Accepts `techniques` and `since_days`. Reads stored data only and writes nothing |
| `get_coverage_stats` | `detections.read` | Overall detection coverage statistics, including total detections and techniques covered, optionally for one source format |
| `detection_metrics` | `detections.read` | The detection rollout's success metrics, reported from data Vigil already stores; nothing is searched |
| `get_detection_count` | `detections.read` | Count of detection rules, optionally filtered by source format |
| `lint_detections` | `detections.read` | Lint a Sigma detection rule for match keys tied to a specific IP, hostname, user, or subnet, returning rewrite guidance to make the rule behavioural. Accepts only one rule's YAML (`rule_yaml`); any other argument is ignored, and an empty or missing `rule_yaml` is an error. To read the lint result for a rule already in a source, use `search_detections` and read its `checks.lint` |
| `check_detection_candidate` | `detections.read` | Lint a candidate Sigma rule and replay it against events the caller already has, including ruled-out events the draft must stay quiet on. Does not query findings or a SIEM and does not write a rule |
| `save_detection_rule` | `detections.write` | Save one drafted or changed rule into Vigil's overlay, then sync it into the rule inventory. Accepts a Splunk copy, an Elastic copy, a Wazuh copy, or any of them together, plus an optional Sigma form. New Splunk, Elastic, and Wazuh copies enter shadow; saving writes nothing to a SIEM |
| `detection_rule_exception` | `detections.write` | Add a customer-specific exception to one of Vigil's overlay copies, or remove one, so an expected host, address, or account is kept out of the rule's query instead of being named in the rule body |
| `reconstruct_run` | `detections.read` | Reconstruct a run's action trace into per-step detection verdicts (`rule`, `loglm`, `both`, or `missed`), correlated to ingested findings |

**Example workflow (coverage and gap analysis):**
```
1. Investigate an incident and identify its techniques, e.g. T1071.001, T1573.001, T1486
2. analyze_coverage(techniques=["T1071.001", "T1573.001", "T1486"])
3. identify_gaps(context="lateral movement") for techniques seen on stored alerts that no loaded rule declares
4. Prioritize the gaps for new detection development
```

**Example workflow (drafting a rule):**
```
1. Draft a Sigma rule for the gap technique
2. lint_detections to check the rule is behavioural, not keyed to one environment
3. check_detection_candidate to replay the draft against proven and ruled-out events already in hand
4. save_detection_rule to save the rule's copies into Vigil's overlay, where Splunk, Elastic, and Wazuh copies enter shadow
```

## Detection over MCP (Vigil's own server)

Separate from the backend tools above and from the upstream `security-detections` package, Vigil's own MCP server (served at `/mcp`) exposes a detection surface to external callers. Read tools require `detections.read` and write tools require `detections.write`:

| Tool | Permission | Description |
|------|------------|-------------|
| `list_detection_rules` | `detections.read` | List rule copies, with filters such as health, SIEM (`elastic` / `splunk` / `wazuh`), and a search term |
| `get_detection_rule` | `detections.read` | One rule copy: its latest version's query and checks, its `stage_history`, and the gaps-run `proposals` it answers |
| `get_detection_coverage` | `detections.read` | ATT&CK coverage by technique and SIEM: each technique an active rule declares or an alert shows, proven, unproven, or with no rule |
| `list_detection_proposals` | `detections.read` | Detection proposals, newest first; `state` narrows them (`draft`, `linted`, `replayed`, `converted`, `shadow`, `live`, `rejected`) |
| `get_detection_proposal` | `detections.read` | One detection proposal with its Sigma, copies, and every step on its record |
| `dismiss_detection_proposal` | `detections.write` | Reject a proposal, with a reason; it stays on the record and on the audit trail |
| `switch_off_detection_rule` | `detections.write` | Switch a shadow rule off and hold it there, with a reason; a rule not in shadow is refused |
| `start_gaps_run` | `detections.write` | Start the detection gaps run on demand (see below) |

### The Proposed Tab

The Detections screen has three sections — **Rules**, **Coverage**, and **Proposed**. The Proposed tab is where the proposals raised by the gaps run are reviewed; each proposal moves through the states listed for `list_detection_proposals` above.

### The Gaps Run

The `identify_gaps` backend tool is read-only: it reports gaps and writes nothing. The **gaps run** is the scheduled counterpart: a daily run that raises the report's gaps — over a rolling window, counting only evidence no earlier run raised — as proposals into the Proposed tab.

The run can also be started on demand with `start_gaps_run` on `/mcp`. It returns a `status` of `queued` (with `proposal_ids`), `nothing_to_raise`, `blind_spots_only`, or `refused`, with a message saying why. Only one gaps run runs at a time: a start is refused while another gaps run is unfinished. The tool is for a caller outside Vigil; a call made inside a Vigil run is refused.

## Agent Integration

Detection tools are not granted to every agent. They are permission-gated in `core/agents/tool_registry.py`: the read tools above require `detections.read`, and `link_detection_rule`, `save_detection_rule`, and `detection_rule_exception` require `detections.write`. An agent can only call a detection tool when its run holds the matching permission.

## Integration with Existing Features

### Approval and Rollout

Saving a rule does not deploy it to a SIEM. `save_detection_rule` writes the rule's copies into Vigil's overlay only; Splunk, Elastic, and Wazuh copies enter shadow, where nobody sees their alerts. There is no automatic deployment to Splunk, Elastic, or another SIEM on approval.

### MITRE ATT&CK Integration

Coverage and gap analysis are expressed in ATT&CK technique terms: `analyze_coverage` reports coverage per technique, and `identify_gaps` lists techniques seen on stored alerts that no loaded rule declares.

## Configuration

### Detection Repository Paths

Configured in `.env`:
```bash
SIGMA_PATHS="${HOME}/security-detections/sigma/rules"
SPLUNK_PATHS="${HOME}/security-detections/security_content/detections"
ELASTIC_PATHS="${HOME}/security-detections/detection-rules/rules"
KQL_PATHS="${HOME}/security-detections/Hunting-Queries-Detection-Rules"
STORY_PATHS="${HOME}/security-detections/security_content/stories"
```

### MCP Server Configuration

In `mcp-config.json`, under the top-level `mcpServers` object:
```json
{
  "mcpServers": {
    "security-detections": {
      "command": "npx",
      "args": ["-y", "security-detections-mcp@3.3.4"],
      "env": {
        "SIGMA_PATHS": "${HOME}/security-detections/sigma/rules",
        "SPLUNK_PATHS": "${HOME}/security-detections/security_content/detections",
        "ELASTIC_PATHS": "${HOME}/security-detections/detection-rules/rules",
        "KQL_PATHS": "${HOME}/security-detections/Hunting-Queries-Detection-Rules",
        "STORY_PATHS": "${HOME}/security-detections/security_content/stories"
      }
    }
  }
}
```

The same version, 3.3.4, is pinned in `infra/docker/mcp-packages/package.json`.

### Updating Detection Repositories

```bash
# Update all repositories
./scripts/setup_detection_repos.sh --update

# View repository status
ls -lh ~/security-detections/
```

## Troubleshooting

### Detection Repositories Not Found

```bash
# Check if repositories exist
ls -l ~/security-detections/

# Re-clone repositories
rm -rf ~/security-detections/
./scripts/setup_detection_repos.sh
```

Until the repositories are fetched, coverage and search features over them stay empty.

### MCP Server Not Loading

```bash
# Verify configuration
cat mcp-config.json | grep security-detections

# Test MCP server standalone (pinned, with the repository paths exported)
export SIGMA_PATHS="${HOME}/security-detections/sigma/rules"
export SPLUNK_PATHS="${HOME}/security-detections/security_content/detections"
export ELASTIC_PATHS="${HOME}/security-detections/detection-rules/rules"
export KQL_PATHS="${HOME}/security-detections/Hunting-Queries-Detection-Rules"
export STORY_PATHS="${HOME}/security-detections/security_content/stories"
npx -y security-detections-mcp@3.3.4

# Check environment variables
echo $SIGMA_PATHS
```

### Low Detection Count

```bash
# Verify repository contents
find ~/security-detections/sigma/rules -name "*.yml" | wc -l
find ~/security-detections/security_content/detections -name "*.yml" | wc -l

# Should show thousands of files once the repositories are fetched
```

### Tools Not Loading

1. Restart the backend server (`uvicorn services.api.main:app --reload`)
2. Check MCP server status via API: `GET /api/mcp/servers/status`
3. Confirm the caller holds the permission the tool requires (`detections.read` or `detections.write`)

## Best Practices

### 1. Lint Before Saving

Lint a drafted Sigma rule before saving it, so it is not keyed to a specific IP, hostname, user, or subnet:
```python
lint_detections(rule_yaml="...")
```

### 2. Check a Candidate Against Events in Hand

Replay a candidate against proven and ruled-out events before saving it. `check_detection_candidate` sets its candidate only when lint passed, a proven event matched, and no ruled-out event matched.

### 3. Keep Environment-Specific Values Out of Rule Bodies

Use `detection_rule_exception` for a customer-specific host, address, or account instead of naming it in the rule itself; exceptions are stored apart from the rule body.

### 4. Regular Coverage Reviews

Review coverage and gaps from stored data:
```python
get_coverage_stats()
identify_gaps(context="")
detection_metrics()
```

## Performance Considerations

### Repository Size

The detection repositories total ~4GB. Clones use `--depth 1` (done automatically by `scripts/setup_detection_repos.sh`).

### Disk Usage

Monitor disk usage:
```bash
du -sh ~/security-detections/
```

Clean old checkouts if needed. `~/security-detections/` is a plain parent directory of the four separate clones, so run `git gc` inside each clone, not in the parent:
```bash
for repo in sigma security_content detection-rules Hunting-Queries-Detection-Rules; do
  git -C ~/security-detections/$repo gc --aggressive --prune=all
done
```

## Resources

- **Sigma Rules**: https://github.com/SigmaHQ/sigma
- **Splunk ESCU**: https://github.com/splunk/security_content
- **Elastic Rules**: https://github.com/elastic/detection-rules
- **KQL Queries**: https://github.com/Bert-JanP/Hunting-Queries-Detection-Rules
- **MITRE ATT&CK**: https://attack.mitre.org/

## Contributing

Found a detection gap? Draft a rule, lint and check it with the tools above, and save it to Vigil's overlay. To contribute back upstream, submit a PR to the upstream repositories:
- Sigma: https://github.com/SigmaHQ/sigma
- Splunk: https://github.com/splunk/security_content
- Elastic: https://github.com/elastic/detection-rules

## License

Detection rule repositories have their own licenses - see individual repos.
{% endraw %}
