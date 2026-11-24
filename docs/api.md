---
layout: docs
title: "API"
permalink: /docs/api/
---

{% raw %}
## Scope

Vigil exposes three caller-facing surfaces, and this page covers
all three:

1. **The frozen `/api/v1` HTTP contract** — the one HTTP surface
   Vigil promises stability on.
2. **Vigil's own MCP server at `/mcp`** — served over HTTP by the
   backend, and documented here by its tool catalogue for findings,
   cases, approvals, and technique rollups.
3. **The ATT&CK REST endpoints** — unversioned REST routes related
   to the rollup tools.

It does not document the separate backend tools in
`core/llm/tool_schemas.py`, which are the internal surface the agent
loop calls; see [Backend tools](/docs/backend-tools/). Where the
two surfaces overlap — notably for approvals — that is called out
below.

## The frozen `/api/v1` HTTP contract

The `/api/v1` HTTP contract is **frozen within a major version**:
every path, operation and shape in
`core/api/v1/contract.snapshot.json` (47 paths at 1.1.4) is held
stable, and within a major it changes only additively — new routes,
new optional fields. A removal or an incompatible shape change is a
major-version change. The full statement of what is frozen is
`VERSIONING.md` in the product repository.

The contract covers: findings, approvals, cases, case metrics, the
workflow catalog, agent runs, the audit trail reads (entries,
export, poll, verify), the autonomy ceiling with its tool classes,
operator agents (`/api/v1/agents`: list, read, `PUT` a manifest,
delete), and entity facts (`/api/v1/entity-facts`).

| Resource | Paths |
|---|---|
| Findings | `/api/v1/findings`, `/api/v1/findings/stats/summary`, `/api/v1/findings/{finding_id}` |
| Approvals | `/api/v1/approvals`, `/api/v1/approvals/needs-you`, `/api/v1/approvals/pending`, `/api/v1/approvals/{action_id}`, `…/{action_id}/approve`, `…/{action_id}/reject` |
| Cases | `/api/v1/cases`, `/api/v1/cases/search`, `/api/v1/cases/owners`, `/api/v1/cases/stats/summary`, `/api/v1/cases/{case_id}` and its `/close`, `/evidence`, `/findings/{finding_id}`, `/iocs` (incl. `/bulk`, `/export`, `/false-positive`), `/merge`, `/rules` sub-paths |
| Case metrics | `/api/v1/cases/metrics/summary`, `/by-priority`, `/by-status`, `/breached`, `/mttd`, `/mttr` |
| Workflows | `/api/v1/workflows`, `/api/v1/workflows/{workflow_id}` |
| Agent runs | `/api/v1/agent-runs`, `/api/v1/agent-runs/{run_id}`, `/api/v1/agent-runs/{run_id}/directives` |
| Audit trail | `/api/v1/audit/entries`, `/api/v1/audit/export`, `/api/v1/audit/poll`, `/api/v1/audit/verify` |
| Autonomy | `/api/v1/autonomy`, `/api/v1/autonomy/tools`, `/api/v1/autonomy/tools/{name}`, `/api/v1/autonomy/resume`, `/api/v1/autonomy/held/release`, `/api/v1/autonomy/held/{action_id}/release` |
| Operator agents | `/api/v1/agents`, `/api/v1/agents/{agent_id}` |
| Entity facts | `/api/v1/entity-facts` |

Two qualifications matter:

- **Beta routes are not frozen.** Routes marked `x-vigil-beta` are
  served under `/api/v1` but are versioned, not frozen: they are
  left out of the snapshot and may change until their shape
  settles.
- **Unversioned `/api/*` routes are not frozen.** Every `/api/*`
  route without a version is the console's own wiring — analytics
  and reporting, `/api/config`, `/api/orchestrator`,
  `/api/llm/providers`, `/api/services`, `/api/ai`, and the rest.
  They may change in any release. External callers should use the
  `/api/v1` spelling wherever one exists.

**Legacy dual-mounting.** Contract routers are also mounted at
their old `/api/<resource>` paths through
`RouterMeta.legacy_prefixes` — for example, findings answer at both
`/api/v1/findings` and `/api/findings`. The legacy spellings are
deprecated once the console has moved to `/api/v1`, and will be
removed no earlier than 2.0. The mechanism is described in
`core/api/v1/README.md` in the product repository.

> **On main, not yet in a release.** Two unversioned routes exist
> on the code `main` branch after 1.1.4 and are **not** part of the
> 1.1.4 release: `GET /api/integration-health` (requires
> `integrations.read`; returns `{checked_at, sources}` and answers
> 503 — never an empty or healthy list — when the store read fails)
> and the history-import list at `GET /api/memory/imports`
> (requires `findings.read`), with `DELETE
> /api/memory/imports/{import_id}` (requires `findings.write`,
> answering 409 while an import is running). Do not rely on them
> against a 1.1.4 install.

## Vigil's MCP server at `/mcp`

Vigil's own MCP server (`tools/mcp/vigil.py`) is served over HTTP
at `/mcp` by the backend (`services/api/mcp_surface.py`). It is the
same server the agent calls in-process, given an address: nothing
about a tool changes, but each request has to say who it is, and
what it does is recorded against that person.

- **Stateless.** Every request is authenticated and bound on its
  own, so a client's requests work across API workers and replicas.
- **Off by default.** The surface is gated three ways, in order: if
  it is off, `/mcp` answers 404 (not 403); with no credential, or
  one that does not work, it answers 401; otherwise the calling
  principal is bound for the duration of the call. Turn it on under
  Settings → Integrations → Vigil MCP server, or with
  `VIGIL_MCP_ENABLED`.
- **Authentication.** Callers authenticate with a personal API
  token (`vgl_api_`, or an older `vgl_mcp_`) sent as a bearer
  header, or with an OAuth access token — see the next section.
  Every tool is additionally gated by a permission (`@requires`);
  a caller without the permission does not get the tool's effect.

### MCP OAuth

Vigil also runs an OAuth authorization server for this surface, so
hosted connectors and interactive clients can sign in instead of
holding a pasted token. Its endpoints sit at the **host root**,
even under a `VIGIL_CONTEXT_PATH` deploy:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource` (and everything under it)
- `/authorize`, `/token`, `/register`, `/revoke`

OAuth is off by default; while it is off, every OAuth path returns
404. The endpoints are rate-limited per client address
(`/register` 20/hour, `/token` 60/minute, `/revoke` 30/minute,
`/authorize` 60/minute). Turning it on, the redirect-URI allowlist,
the consent flow, token lifetimes, and revocation are covered on
the [MCP OAuth](/docs/mcp-oauth/) page.

### Which tools are frozen

The server serves 60 tools. Of those, **25 are frozen**: the name
and input schema of every tool in `FROZEN_TOOLS`
(`tools/mcp/vigil.py`), as held by
`tools/mcp/frozen_tools.snapshot.json`. A tool is frozen when the
HTTP operation it mirrors is frozen in `/api/v1`. Tools outside
that set carry the 0.x terms: they may change in any minor release.

The catalogue below documents the findings, cases, approvals, and
rollup tools in detail. The same server also serves detection
tools (covered on the
[Detection engineering](/docs/detection-engineering/) page), run
tools (`start_run`, `list_runs`, `get_run`, `send_directive`),
insider-lead tools (`propose_lead_hunt`, `insider_leads`), audit,
autonomy, entity-facts (`get_entity_facts`), and workflow /
operator-agent tools.

## Data Model

### Finding

Primary security observation with MITRE predictions.

```json
{
  "finding_id": "f-20260209-001",
  "mitre_predictions": {"T1071.001": 0.85, "T1048.003": 0.72},
  "anomaly_score": 0.92,
  "entity_context": {
    "src_ip": "10.0.1.15",
    "dst_ip": "203.0.113.50",
    "hostname": "workstation-042",
    "user": "jsmith"
  },
  "timestamp": "2024-01-15T14:32:18Z",
  "data_source": "flow",
  "severity": "high"
}
```

The fields above follow `core/storage/schemas/finding.py`
(`FindingSchema`). A finding has no stored `status` field: its state is
derived as `open` (not dismissed and in no closed case), `dismissed`,
or `resolved` (in a closed case). The `finding_id` above is an example
value, not a prescribed ID format.

### Case

Investigation grouping related findings.

```json
{
  "case_id": "case-xxx",
  "title": "Potential C2 Beaconing",
  "finding_ids": ["f-20260209-001"],
  "status": "investigating",
  "priority": "high",
  "assignee": "analyst@example.com",
  "notes": [...],
  "timeline": [...],
  "created_at": "2024-01-15T15:00:00Z"
}
```

Case fields follow `core/storage/schemas/case.py` (`CaseSchema`);
the detail response is `core/storage/schemas/case_api.py`, and the
related entity schemas (comments, evidence, IOCs, tasks, and the
rest) are in `core/storage/schemas/case_entities.py`. The flat
`notes` / `timeline` arrays in the example are illustrative only.
Valid case
statuses are `new`, `open`, `investigating`, and `closed`
(`core/cases/case_status.py`).

### Severity

Severity is not computed from `anomaly_score` and MITRE confidence.
During SIEM ingestion, `normalize_severity()` in
`core/ingestion/siem_ingestion_service.py` maps the raw source severity
string to one of `critical`, `high`, `medium`, `low`, or `info`,
defaulting to `medium` when no value matches.

## MCP Tools - Findings

### `get_finding`

```json
{ "finding_id": "f-xxx" }
```

### `list_findings`

Parameters are flat; there is no `filters` wrapper. `limit` defaults
to 20 and is capped at 25.

```json
{
  "severity": "high",
  "data_source": "flow",
  "state": "open",
  "sort_by": "timestamp",
  "sort_order": "desc",
  "offset": 0,
  "limit": 20
}
```

`state` is one of `open`, `dismissed`, or `resolved`. Other optional
parameters are `cluster_id` and `min_anomaly_score`; `sort_by` is one
of `timestamp`, `anomaly_score`, or `severity`.

### `get_technique_rollup`

MITRE technique aggregation across findings.

```json
{
  "min_confidence": 0.5,
  "time_range": "24h"
}
```

`time_range` is one of `24h`, `7d`, `30d`, or `all` (the default).
`min_confidence` defaults to 0.

Returns:

```json
{
  "total_techniques": 1,
  "techniques": [
    {
      "technique_id": "T1071.001",
      "technique_name": "Application Layer Protocol: Web Protocols",
      "tactic": "command-and-control",
      "count": 15,
      "severities": {"critical": 0, "high": 15, "medium": 0, "low": 0}
    }
  ],
  "excluded_occurrences": 0
}
```

## MCP Tools - Case Management

### `create_case`

Only `title` is required.

```json
{
  "title": "Investigation title",
  "finding_ids": ["f-xxx", "f-yyy"],
  "priority": "high",
  "description": "Case description"
}
```

### `update_case`

Parameters are flat; there is no `updates` wrapper.

```json
{
  "case_id": "case-xxx",
  "status": "investigating",
  "priority": "high",
  "assignee": "analyst@example.com",
  "add_note": "Investigation note"
}
```

Parameters are `case_id` (required) plus optional `title`,
`description`, `status`, `priority`, `assignee`, and `add_note`.
`status` must be one
of `new`, `open`, `investigating`, or `closed`.

### `add_finding_to_case`

Adding a finding to an existing case is a separate tool, not part of
`update_case`.

```json
{
  "case_id": "case-xxx",
  "finding_id": "f-zzz"
}
```

### `list_cases`

```json
{
  "status": "investigating",
  "priority": "high",
  "limit": 50
}
```

### `get_case`

```json
{
  "case_id": "case-xxx"
}
```

## MCP Tools - Approval

### `create_approval_action`

`action_type`, `title`, `description`, `target`, `confidence` and
`reason` are all required; only `evidence` is optional.
`action_type` is one of `isolate_host`,
`block_ip`, `block_domain`, `quarantine_file`, `disable_user`, or
`custom`, and `confidence` is a number between 0 and 1, and must be above 0 for the five containment kinds.

The action is created with `human_only=True`, and the caller's
`confidence` never releases it: the row waits in the queue for a
person.

```json
{
  "action_type": "isolate_host",
  "title": "Isolate compromised host",
  "description": "Isolate the host pending investigation",
  "target": "192.168.1.100",
  "confidence": 0.85,
  "reason": "Confirmed ransomware activity",
  "evidence": ["f-xxx"]
}
```

### `list_approval_actions`

```json
{
  "status": "pending",
  "action_type": "isolate_host"
}
```

`status` is one of `pending`, `approved`, `rejected`, `executed`, or
`failed`.

### `get_approval_action`, `approve_action`, `reject_action`

The MCP server also serves the decision-side approval tools, gated
by `ai_decisions.read` / `ai_decisions.approve`:

- `get_approval_action(action_id)` — get one action's details.
- `approve_action(action_id)` — labelled "Approve action (confirmed
  in Approvals)": the decision is confirmed in the Approvals UI.
- `reject_action(action_id, reason)` — reject a pending action; the
  actor is the caller, not an argument.

The backend tools in `core/llm/tool_schemas.py` expose an
overlapping approval surface — `list_pending_approvals`,
`get_approval_action`, `approve_action`, `reject_action`, and
`get_approval_stats`. Three of the five names are the same tools as
on MCP; only the list and stats calls differ in name
(`list_approval_actions` on MCP, `list_pending_approvals` /
`get_approval_stats` backend-only). The two surfaces are not
distinct.

## ATT&CK REST Endpoints

Findings for a technique are available over REST, not as an MCP tool:
`GET /api/attack/techniques/{technique_id}/findings`, from the attack
router in `core/threat_intel/attack_router.py`. It accepts
`min_confidence` and `time_range` (`24h`, `7d`, `30d`, or `all`).

```text
GET /api/attack/techniques/T1071.001/findings
```

The same router also serves the rollup over REST:
`GET /api/attack/techniques/rollup`. It takes the same
`min_confidence` / `time_range` parameters, and an optional `run_id`,
which switches it to a per-run coverage report.

These are unversioned routes (see the `/api/v1` section above):
working, but not part of the frozen contract.

There is no ATT&CK Navigator layer generator tool: no
`get_attack_layer` or `create_attack_layer` tool exists.

## Rate Limiting

There are no per-tier rate limits for findings, evidence, or raw log
export. The API uses a shared slowapi `Limiter`
(`services/api/middleware/rate_limit.py`, backed by Redis with an
in-memory fallback), and limits are set per route where they apply —
for example, several auth routes in `services/api/routers/auth.py` are
limited to `5/minute`, and the token refresh route to `30/minute`.
The OAuth endpoints carry their own per-address limits, listed in
the MCP OAuth section above.

## Errors

API error responses use a `detail` / `code` envelope, optionally with
a `trace_id`:

```json
{
  "detail": "Finding not found",
  "code": "NOT_FOUND"
}
```

Codes emitted by the API include:

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Resource not found (default code of `NotFoundError` in `core/exceptions.py`) |
| `INTERNAL_ERROR` | Unhandled internal error |
| `BUDGET_EXCEEDED` | Virtual-key budget is spent |
| `ACCOUNT_LOCKED` | Account locked after repeated failed sign-ins |
| `AUDIT_PAUSED` | Audit trail is paused |

The handlers are in `services/api/errors.py`.

## Entity Context by Data Source

`entity_context` is a free-form JSONB field
(`core/storage/models/finding.py`); there is no fixed per-source
schema. The shapes below are illustrative examples only.

### Flow

```json
{
  "src_ip": "10.0.1.15",
  "dst_ip": "203.0.113.50",
  "src_port": 54321,
  "dst_port": 443,
  "protocol": "tcp",
  "bytes_sent": 1024,
  "hostname": "workstation-042"
}
```

### DNS

```json
{
  "src_ip": "10.0.1.15",
  "query_name": "suspicious.com",
  "query_type": "A",
  "response_ips": ["203.0.113.50"]
}
```

### WAF

```json
{
  "src_ip": "203.0.113.100",
  "method": "POST",
  "uri": "/api/upload",
  "rule_matched": "942100",
  "rule_category": "SQL Injection"
}
```

## Schemas

There is no `data/schemas/` directory and no published
`finding.schema.json`, `case.schema.json`, or
`attack-layer.schema.json`. The serialisation sources are the Python
schemas in the code repository:

- `core/storage/schemas/finding.py`
- `core/storage/schemas/case.py`

The two frozen surfaces are held by machine-readable snapshots in
the code repository: `core/api/v1/contract.snapshot.json` for the
`/api/v1` contract, and `tools/mcp/frozen_tools.snapshot.json` for
the frozen MCP tools.
{% endraw %}
