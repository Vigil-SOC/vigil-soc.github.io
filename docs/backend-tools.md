---
layout: docs
title: "Backend Tools"
permalink: /docs/backend-tools/
---

{% raw %}
## Overview

Backend tools are Vigil's built-in Python tools. Their schemas are defined in
`core/llm/tool_schemas.py` as `ALL_TOOLS`, and they are executed by the agent
layer through `core/agents/tool_registry.py` — described in that module as
"the built-in backend tools, and the one place they are executed". A tool name
absent from the registry manifest is not a backend tool.

There is no Claude Agent SDK tool path: the `claude-agent-sdk` dependency was
dropped (see the project changelog), and `ClaudeService.chat()` performs a
single completion only — in its own docstring, "No tools and no loop — both
live in the agent layer."

## Architecture

```
User Browser
    ↓
Web UI / agent run
    ↓
Agent layer — core/agents/tool_registry.py
(manifest over ALL_TOOLS + INTEGRATION_TOOLS)
    ↓
Backend Tools (Python)
    ↓
Database / Detection Rules / Services
```

## Available Tools

The lists below are the tool groups defined in `core/llm/tool_schemas.py` at
v1.1.2. Treat the schema file, not this page, as the canonical inventory.

### Security Detection Tools

Detection answers come from the configured detection rule sources, as
`core/detections/inventory` syncs them into Postgres:

- **analyze_coverage** - Analyze detection coverage for MITRE ATT&CK techniques
- **search_detections** - Search detection rules by keywords
- **link_detection_rule** - Link a detection rule
- **identify_gaps** - Identify detection gaps for threat contexts
- **get_coverage_stats** - Get overall coverage statistics
- **detection_metrics** - Detection metrics
- **get_detection_count** - Get detection counts by source format
- **lint_detections** - Lint detection rules
- **check_detection_candidate** - Check a detection candidate
- **save_detection_rule** - Save a detection rule
- **detection_rule_exception** - Detection rule exceptions
- **reconstruct_run** - Reconstruct a run

### Finding & Case Tools

Interact with security findings and cases:

- **list_findings** - List findings with filters (severity, data source)
- **search_findings** - Keyword search across findings
- **get_findings_stats** - Finding statistics and aggregations
- **get_finding** - Get detailed finding information
- **dismiss_finding** - Dismiss a finding
- **list_cases** - List investigation cases
- **read_case_shell** - Read a case shell
- **create_case** - Create new investigation case
- **add_finding_to_case** - Add finding to case
- **update_case** - Update case status, priority, assignee, and metadata
- **restrict_case** - Restrict case access
- **change_case_readers** - Change who can read a case
- **add_resolution_step** - Document a resolution step with description, action, and result
- **list_completed_hunts** - List completed hunts
- **list_learning_episodes** - List learning episodes
- **export_learning_episodes** - Export learning episodes
- **replay_hunt** - Replay a hunt

### MITRE ATT&CK Tools

- **get_technique_rollup** - Get technique statistics from findings

### Threat Intel Tools

- **lookup_indicators** - Look up threat indicators
- **propose_feed_hunts** - Propose hunts from threat feeds

### Approval Workflow Tools

Manage autonomous response actions:

- **list_pending_approvals** - List actions awaiting approval
- **get_approval_action** - Get specific action details
- **approve_action** - Approve pending action
- **reject_action** - Reject pending action
- **get_approval_stats** - Get approval statistics

### Memory Tools

- **recall_entity** - Recall a remembered entity
- **check_hunt_coverage** - Check hunt coverage

### Skill Tools

- **read_skill** - Read a skill from the skill library

### Integration Tools

Two further tools are chat's door to the connected MCP integrations. They are
declared in `tool_schemas.py` but deliberately kept out of `ALL_TOOLS`, and
are included in the tool registry's manifest alongside it:

- **find_integration_tools** - Search the tools of the connected integrations by keyword
- **call_integration_tool** - Call a tool of a connected integration

## Usage

Tool-driven work goes through the agent layer, not through `ClaudeService`
directly. `ClaudeService` (in `core/llm/harness/claude.py`) takes a single
optional constructor argument, `provider_api_key_ref`, and its `chat()`
method returns one completion with no tool execution:

```python
from core.llm.harness.claude import ClaudeService

claude = ClaudeService()
response = claude.chat(
    message="Summarize the current state of the platform",
    max_tokens=2048
)
```

Requests that need tools — detection coverage analysis, finding and case
queries, gap analysis, approval actions — are handled by agent runs, which
call the backend tools above via `core/agents/tool_registry.py`.

## Implementation Details

### Tool Execution Flow

1. User sends a message via the web UI
2. The agent layer runs with the tool registry manifest
   (`ALL_TOOLS` plus the two integration tools)
3. The model decides which tools to call based on user intent
4. `core/agents/tool_registry.py` executes the tool calls
5. Tool results are returned for synthesis
6. Final response sent to user

### Tool Definitions

Tool schemas are defined in `core/llm/tool_schemas.py`:

```python
from core.llm.tool_schemas import ALL_TOOLS

# Contains the core backend tool groups:
# - security detection tools
# - finding/case tools
# - MITRE ATT&CK tools
# - threat intel tools
# - approval tools
# - memory tools
# - skill tools
```

### Tool Routing

Tool execution is handled in `core/agents/tool_registry.py`, which builds its
manifest over `ALL_TOOLS` and `INTEGRATION_TOOLS` imported from
`core/llm/tool_schemas.py`.

## Configuration

### Detection Rule Sources

Detection tools answer from the rules held by every configured detection
source (Sigma, Splunk, Elastic, KQL, and others), as
`core/detections/inventory` syncs them into Postgres. Sources are configured
in `detection_sources.json`; `core/detections/detection_rules_service.py`
builds the `SIGMA_PATHS`, `SPLUNK_PATHS`, `ELASTIC_PATHS`, and `KQL_PATHS`
variables from those configured sources when launching the
Security-Detections-MCP server.

To clone the public detection repositories locally, run:

```bash
./scripts/setup_detection_repos.sh
```

This clones `sigma/`, `security_content/`, `detection-rules/`, and
`Hunting-Queries-Detection-Rules/`. The same step is available during dev
setup only as an opt-in, because it is off by default:

```bash
SETUP_DETECTION_REPOS=1 ./setup_dev.sh
```

### Database Configuration

The Python backend does not use `DATABASE_URL` — that variable is not
consulted (it is the TypeScript agent's knob). The database connection comes
from `POSTGRESQL_CONNECTION_STRING` read from the encrypted store (written
via Settings → PostgreSQL), falling back to the `POSTGRES_*` variables. See
`core/storage/connection.py`.

## Testing

There is no dedicated backend-tools test file. To confirm the tool schemas
load, import them:

```bash
python -c "from core.llm.tool_schemas import ALL_TOOLS; print(len(ALL_TOOLS))"
```

## Backend Tools and MCP

Backend tools and MCP integrations are complementary, not alternatives:

- Backend tools are the built-in tools in `ALL_TOOLS`, executed by the agent
  layer via `core/agents/tool_registry.py`.
- Connected MCP integrations are reached from chat through the
  `find_integration_tools` / `call_integration_tool` pair, and MCP servers
  also run server-side — the code ships an MCP runner deployable under
  `services/mcp_runner/`. MCP is not desktop-only and is accessible from the
  web UI through those integration tools.

## Troubleshooting

### Tools Not Loading

```bash
# Check the tool schemas import and see what loaded
python -c "from core.llm.tool_schemas import ALL_TOOLS; print(len(ALL_TOOLS))"
```

### Detection Rules Not Found

```bash
# Ensure detection repos are cloned
ls -la ~/security-detections/
# Should show: sigma/, security_content/, detection-rules/, Hunting-Queries-Detection-Rules/

# Re-run setup if missing
./scripts/setup_detection_repos.sh
```

### Database Errors

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# The backend reads POSTGRESQL_CONNECTION_STRING from the encrypted store
# (or POSTGRES_* variables); DATABASE_URL is not consulted.

# Test connectivity via the session factory
python -c "from core.storage.connection import get_db_session; s = get_db_session(); print(s)"
```

## Future Enhancements

The following are aspirational ideas, not shipped features; no code
counterpart has been verified for them:

- [ ] Add caching layer for detection queries
- [ ] Implement Redis for cross-request caching
- [ ] Add more detection rule sources (YARA, Snort)
- [ ] Expand approval workflow tools
- [ ] Add bulk operations for findings/cases
- [ ] Implement tool usage analytics

## See Also

- [Detection Engineering Guide](/docs/detection-engineering/)
- [API Reference](/docs/api/)
- [Integration Guide](/docs/integrations/)
{% endraw %}
