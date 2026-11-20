---
layout: docs
title: "Architecture"
permalink: /docs/architecture/
---

{% raw %}
## Overview

Vigil's tool-calling work runs in **one TypeScript agent loop**, split
across two files: `services/agent/core/loop.ts` (the `Harness` interface
and `commitTurn`) and `services/agent/core/stream.ts` (`streamTurn`; the
budget lives in `budget.ts` and the prompt-injection scan in
`security.ts`, both wired in by the loop). The FastAPI backend enqueues agent runs,
the loop calls LLM providers through the **Bifrost** gateway, and tools are
dispatched through the backend tool registry and the **MCP registry** for
connected integrations. Python provides one-shot completions, not a second
loop — see "One loop, and where it is" below.

MCP is part of the current architecture, not a predecessor to it: startup
constructs an empty MCP registry and MCP tools connect lazily when an agent
actually needs them (eager connection is preserved only outside DEV_MODE
unless overridden), with registration following connection; chat reaches
their tools through the integration-door tools described under Tool
Categories. No desktop application is required; the web UI is the client.

## Architecture Diagram

```
┌─────────────┐
│   Browser   │
│   (Web UI)  │
└──────┬──────┘
       │ HTTPS
       ↓
┌─────────────────────┐
│  FastAPI Backend    │
│  (Python, 6987)     │
│  ├── API Endpoints  │
│  └── Agent-run      │
│      queueing       │
└──────┬──────────────┘
       │ enqueued runs
       ↓
┌─────────────────────┐
│  TypeScript Agent   │
│  Loop               │
│  services/agent/    │
│  core/stream.ts     │
└──────┬──────────────┘
       │ via Bifrost gateway
       ↓
┌─────────────────────┐
│  LLM Providers      │
│  (default model:    │
│   claude-sonnet-4-6)│
└──────┬──────────────┘
       │ tool calls dispatched by the loop
       ↓
┌─────────────────────┐
│   Backend Tools     │
│  ├── Security       │
│  │   Detections     │
│  ├── Findings &     │
│  │   Cases          │
│  ├── Approvals      │
│  ├── ATT&CK         │
│  ├── Threat Intel   │
│  ├── Memory         │
│  └── Skills         │
│   + MCP registry    │
│     (integrations)  │
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│   Data Layer        │
│  ├── PostgreSQL     │
│  └── Detection      │
│      Rules (synced  │
│      into Postgres) │
└─────────────────────┘
```

## Stack Components

### Frontend
- React/TypeScript
- Vite dev server
- Port: 6988

### Backend
- FastAPI (Python 3.12)
- LLM traffic via the Bifrost gateway
- Backend tools
- Port: 6987

### Database
- PostgreSQL 16
- Findings, cases, embeddings
- Port: 5432

### Detection Rules
- Rules in Sigma, Splunk, Elastic and KQL formats, plus rules from Kibana's
  detection engine, Splunk saved searches and the Wazuh manager
- Answers come from the rules as `core/detections/inventory` syncs them into
  Postgres — not from an in-memory index of the cloned repositories alone

## Tool Categories

Tool schemas are defined in `core/llm/tool_schemas.py`. See the
[Backend Tools Guide](/docs/backend-tools/) for detailed documentation.

### 1. Security Detection Tools
Access to the detection rule database:
- `analyze_coverage` - Coverage by MITRE technique
- `search_detections` - Keyword search across rules
- `link_detection_rule` - Link a detection rule
- `identify_gaps` - Gap analysis
- `get_coverage_stats` - Statistics
- `detection_metrics` - Detection metrics
- `get_detection_count` - Counts by source
- `lint_detections` - Lint detection rules
- `check_detection_candidate` - Check a candidate detection
- `save_detection_rule` - Save a detection rule
- `detection_rule_exception` - Manage per-copy rule exceptions
- `reconstruct_run` - Reconstruct a run

### 2. Finding & Case Tools
SOC investigation workflow:
- `list_findings` - Query findings
- `search_findings` - Keyword search across findings
- `get_findings_stats` - Finding statistics
- `get_finding` - Get specific finding
- `dismiss_finding` - Dismiss a finding
- `list_cases` - Query cases
- `read_case_shell` - Read a case shell
- `create_case` - Create new case
- `add_finding_to_case` - Associate findings
- `update_case` - Update case status and metadata
- `restrict_case` - Restrict case access
- `change_case_readers` - Change who can read a case
- `add_resolution_step` - Document resolution steps
- `list_completed_hunts` - List completed hunts
- `list_learning_episodes` - List learning episodes
- `export_learning_episodes` - Export learning episodes
- `replay_hunt` - Replay a hunt

### 3. MITRE ATT&CK Tools
Technique mapping and visualization:
- `get_technique_rollup` - Technique statistics

### 4. Approval Tools
Autonomous response workflow:
- `list_pending_approvals` - Pending actions
- `get_approval_action` - Action details
- `approve_action` - Approve action
- `reject_action` - Reject action
- `get_approval_stats` - Statistics

### 5. Threat Intel Tools
- `lookup_indicators` - Look up observables in the threat-indicator database
- `propose_feed_hunts` - Propose hunts for recently fed, unhunted indicators

### 6. Memory Tools
- `recall_entity` - Recall what past investigations saw and concluded about an entity
- `check_hunt_coverage` - Check whether a hunt already covers a report or entity

### 7. Skill Tools
- `read_skill` - Read a skill from the skill library

### Integration Tools

Two further tools sit outside the categories above and form chat's door to
the connected MCP integrations:

- `find_integration_tools` - Search the tools of connected integrations by keyword
- `call_integration_tool` - Run one tool that `find_integration_tools` returned

## Request Flow

### Example: Detection Coverage Query

```
1. User: "What's our coverage for T1059.001?"
   ↓
2. Web UI → POST /api/claude/chat/stream
   ↓
3. Work that needs tools is enqueued as an agent run
   ↓
4. The TypeScript agent loop drives the run, calling the LLM
   via the Bifrost gateway
   ↓
5. The loop dispatches the tool call: analyze_coverage,
   via the agent layer / tool registry
   (core/agents/tool_registry.py)
   ↓
6. Detection answers come from the rules synced into
   Postgres by core/detections/inventory
   ↓
7. Example output (illustrative only):
   { "T1059.001": { count: 234, by_source: {...} } }
   ↓
8. The loop synthesizes a response
   ↓
9. Web UI displays the streamed result
```

## Configuration

LLM provider credentials (Anthropic / OpenAI / Ollama / Vertex / OpenRouter) are configured in
the web UI under **Settings → AI models** and stored in the
encrypted secret store at `~/.vigil/secrets.enc`. The backend pushes them
to Bifrost over its admin API in the same request. See
[CONFIGURATION.md](/docs/configuration/) and [STATE.md](/docs/state/) for the
full split between bootstrap config and secrets.

### Environment Variables (.env)

Bootstrap-only — nothing sensitive belongs here.

```bash
# Detection Rules
SIGMA_PATHS="${HOME}/security-detections/sigma/rules"
SPLUNK_PATHS="${HOME}/security-detections/security_content/detections"
ELASTIC_PATHS="${HOME}/security-detections/detection-rules/rules"
KQL_PATHS="${HOME}/security-detections/Hunting-Queries-Detection-Rules"

# LLM gateway (Bifrost) — provider keys are NOT set here.
# Host-run default; "bifrost" as a hostname resolves only
# inside the compose network, which injects its own value.
BIFROST_URL="http://localhost:8080"
```

The Python backend does **not** read a `DATABASE_URL` setting — that is the
TypeScript agent's knob. Python sessions go through `DatabaseConfig`, which
uses `POSTGRESQL_CONNECTION_STRING` read from the encrypted secret store, or
the `POSTGRES_*` settings.

### One loop, and where it is

There is exactly **one tool-calling loop** in Vigil, and it is TypeScript:
`services/agent/core/loop.ts` defines the `Harness` interface and
`commitTurn`, and `services/agent/core/stream.ts` exports `streamTurn`.
Together they own the budget (in `budget.ts`), the approval gate, the
prompt-injection scan (in `security.ts`) and the turn cap, so anything that reasons with tools gets
all four by construction rather than by remembering to.

Python holds **no** loop. `ClaudeService.chat()` is a one-shot completion for
callers that want a single answer and no tools:

```python
from core.llm.harness.claude import ClaudeService

answer = ClaudeService().chat(message="...", system_prompt="...")
```

Most one-shot callers now go through `core/llm/oneshot.py` rather than
constructing `ClaudeService` directly.

Work that needs tools is enqueued as a run and the worker drives it:

```python
from core.agents.queue import build_start_job, enqueue_run, new_run_id

run_id = new_run_id()
await enqueue_run(build_start_job(run_id, "investigate", request, enqueued_by="api"))
```

Five loops preceded this — `claude_service`, `agent_runner`, `workflows_service`,
`orchestrator` and `openai_agent_service` — with three tool dispatchers and four
transports between them. `scripts/check_one_loop.py` runs in CI and fails when a
second one appears, because each addition looked reasonable on its own and review
did not catch the fifth.

## Deployment

### Development

```bash
# Terminal 1: Database
cd infra/docker && docker compose up -d postgres

# Terminal 2: Backend
source venv/bin/activate
uvicorn services.api.main:app --host 127.0.0.1 --port 6987 --reload

# Terminal 3: Frontend
cd clients/web && npm run dev
```

### Production (Docker)

```bash
cd infra/docker
docker compose up -d
```

The compose file at `infra/docker/docker-compose.yml` defines more than the
database and API, including:

- PostgreSQL
- Redis
- Backend API
- Agent, worker and daemon services (the daemon's compose service is
  `soc-daemon`)
- Medic (`medic`, `medic-dockerproxy`, `medic-gateway`)
- MCP runner
- Bifrost gateway

## Performance

- **Database**: PostgreSQL with connection pooling enabled
- **Claude API**: Rate limited by the provider, via the Bifrost gateway

No verified latency, resource-usage or concurrent-user figures are published
for this stack; earlier tables of such figures had no counterpart in the code
and have been removed.

## Monitoring

### Health Endpoints

```bash
# Backend health
curl http://localhost:6987/api/health

# Database connectivity
curl http://localhost:6987/api/storage/status
```

### Logs

```bash
# Backend logs (stdout when running uvicorn directly, or Docker logs)
docker logs deeptempo-postgres  # PostgreSQL logs
docker logs -f <backend-container>  # Backend API logs
```

## Security

### API Key Management
- Preferred store: the Fernet-encrypted file at `~/.vigil/secrets.enc`
- Fallbacks, in priority order: environment variables, the repo-root `.env`
  (read-only), and the state-dir `.env` file
- Keyring access is off by default (it triggers macOS keychain prompts) and
  is used only when explicitly enabled
- Provider keys configured in the web UI are pushed to Bifrost over its
  admin API (see Configuration above)

### Tool Permissions
- Gated write/dangerous operations exist (e.g. Cloudflare enforcement,
  detection-rule writes, case mutation, a `shell` grant); they are not
  ungated — response actions require approval
- Approval required for response actions
- Rate limiting on API endpoints
- Authentication required (configurable)

## How Tool Access Works

Backend tools and MCP integrations are both current parts of the
architecture; neither replaces the other:

```
Web UI → FastAPI Backend → agent-run queue → TypeScript agent loop
                                                  ↓
                          Backend tools (tool registry) + MCP registry
                                                  ↓
                                               Services
```

- Backend tools are defined in `core/llm/tool_schemas.py` and dispatched
  through the agent layer / `core/agents/tool_registry.py`.
- Connected MCP servers are registered in the MCP registry; chat reaches
  their tools through `find_integration_tools` and `call_integration_tool`.
- LLM traffic goes through the Bifrost gateway, not a direct
  backend-to-provider tool loop.

## Troubleshooting

### "No tools loaded"

```python
# Tools are the registry's, not an LLM client's. Startup populates it.
from core.integrations.mcp.registry import MCPRegistry, safe_tool_names
print(safe_tool_names(MCPRegistry()))
```

An empty list means no MCP server connected this boot: the disk cache is a
warm-start artifact and a server that failed to connect is deliberately not
registered, so a model cannot claim a capability it has no session for.

### "Detection rules not found"

```bash
# Check repositories
ls -la ~/security-detections/
# Should show: sigma/, security_content/, detection-rules/, Hunting-Queries-Detection-Rules/

# Clone if missing
./scripts/setup_detection_repos.sh
```

### "Database connection failed"

```bash
# Check PostgreSQL
docker ps | grep postgres

# Check connection string
echo $POSTGRESQL_CONNECTION_STRING
```

## Development

### Adding New Tools

1. **Define tool schema** in `core/llm/tool_schemas.py`:

```python
{
    "name": "my_new_tool",
    "description": "What the tool does",
    "input_schema": {
        "type": "object",
        "properties": {
            "param1": {"type": "string", "description": "..."}
        },
        "required": ["param1"]
    }
}
```

2. **Implement and dispatch the tool** in the agent layer — dispatch lives
   in the TypeScript agent layer (`services/agent/core/`) and in
   `core/agents/tool_registry.py`. Python's `ClaudeService` is a one-shot
   completion with no tools and no loop, so there is no tool-routing step
   to add there.

3. **For MCP tools**, add them in `tools/mcp/vigil.py` so they are served
   through the MCP registry.

4. **Test** with the test suite below.

### Running Tests

```bash
# Test suite (tests/ contains live/, medic_compose/ and medic_eval/)
pytest tests/
```

## Documentation

- [Backend Tools Guide](/docs/backend-tools/) - Detailed tool documentation
- [Detection Engineering](/docs/detection-engineering/) - Detection rule usage
- [Integrations](/docs/integrations/) - Backend tool integration overview
- [API Reference](https://github.com/Vigil-SOC/vigil/blob/main/services/api/main.py) - FastAPI documentation

## Support

For issues or questions:
- GitHub Issues: https://github.com/Vigil-SOC/vigil/issues
- Label: `backend-tools`
- Include: Backend logs, tool name, error message
{% endraw %}
