---
layout: docs
title: "API"
permalink: /docs/api/
---

{% raw %}
## Scope

This page documents the MCP server tools in `tools/mcp/vigil.py` for
findings, cases, approvals, and technique rollups, plus the related
ATT&CK REST endpoints. It does not document the separate backend tools
in `core/llm/tool_schemas.py`; where the two surfaces differ — notably
for approvals — that is called out below.

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

Case fields follow `core/storage/schemas/case.py`. Valid case
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

`description` is required. `action_type` is one of `isolate_host`,
`block_ip`, `block_domain`, `quarantine_file`, `disable_user`, or
`custom`, and `confidence` is a number between 0 and 1.

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

The backend tools in `core/llm/tool_schemas.py` expose a distinct
approval surface — `list_pending_approvals`, `get_approval_action`,
`approve_action`, `reject_action`, and `get_approval_stats` — separate
from the MCP pair above.

## ATT&CK REST Endpoints

Findings for a technique are available over REST, not as an MCP tool:
`GET /api/attack/techniques/{technique_id}/findings`, from the attack
router in `core/threat_intel/attack_router.py`. It accepts
`min_confidence` and `time_range` (`24h`, `7d`, `30d`, or `all`).

```text
GET /api/attack/techniques/T1071.001/findings
```

There is no ATT&CK Navigator layer generator tool: no
`get_attack_layer` or `create_attack_layer` tool exists.

## Rate Limiting

There are no per-tier rate limits for findings, evidence, or raw log
export. The API uses a shared slowapi `Limiter`
(`services/api/middleware/rate_limit.py`, backed by Redis with an
in-memory fallback), and limits are set per route where they apply —
for example, several auth routes in `services/api/routers/auth.py` are
limited to `5/minute`, and the token refresh route to `30/minute`.

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
{% endraw %}
