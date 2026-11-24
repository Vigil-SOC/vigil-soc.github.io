---
layout: docs
title: "SLA Policy API"
permalink: /docs/sla-api/
---

{% raw %}
## Overview

The SLA Policy Management API provides comprehensive CRUD operations for managing Service Level Agreement policies in Vigil.

**Base URL**: `/api/sla-policies`

> Spelling note: the collection routes are registered with a trailing
> slash (`POST /api/sla-policies/`). The no-slash spelling used in some
> examples below redirects to it; scripted callers should standardise on
> one spelling (the trailing-slash form) to avoid the redirect.

> Note: Policy IDs, names, and times shown in the examples on this page (for example `sla-critical-default` with 1h response / 4h resolution) are illustrative examples only. No default policies are seeded or shipped pre-configured; policies are created through this API.

## Authentication

All endpoints require authentication. Include the authentication token in your request headers:

```bash
Authorization: Bearer <your-token>
```

In addition to authentication, endpoints are permission-gated:

- Reads (`GET`) require the `cases.read` permission.
- Writes — create, update, delete, and set-default (`POST`, `PUT`, `DELETE`) — require the `cases.write` permission.

A caller with only read permission will be denied write operations.

## Endpoints

### 1. List All SLA Policies

Get a list of all SLA policies with optional filtering.

**Endpoint**: `GET /api/sla-policies`

**Query Parameters**:
- `active_only` (boolean, optional): Only return active policies
- `priority_level` (string, optional): Filter by priority level (critical, high, medium, low)
- `default_only` (boolean, optional): Only return default policies

**Example Request**:
```bash
# Get all policies
curl -X GET "http://localhost:6987/api/sla-policies"

# Get only active policies
curl -X GET "http://localhost:6987/api/sla-policies?active_only=true"

# Get default policy for high priority
curl -X GET "http://localhost:6987/api/sla-policies?priority_level=high&default_only=true"
```

**Example Response**:
```json
{
  "policies": [
    {
      "policy_id": "sla-critical-default",
      "name": "Critical Priority SLA",
      "description": "Standard SLA for critical priority cases",
      "priority_level": "critical",
      "response_time_hours": 1.0,
      "resolution_time_hours": 4.0,
      "business_hours_only": false,
      "escalation_rules": null,
      "notification_thresholds": [75, 90, 100],
      "is_active": true,
      "is_default": true,
      "created_at": "2024-01-15T10:00:00",
      "updated_at": "2024-01-15T10:00:00"
    }
  ],
  "total": 1
}
```

---

### 2. Get Specific SLA Policy

Retrieve details of a specific SLA policy.

**Endpoint**: `GET /api/sla-policies/{policy_id}`

**Path Parameters**:
- `policy_id` (string, required): The policy ID

**Example Request**:
```bash
curl -X GET "http://localhost:6987/api/sla-policies/sla-critical-default"
```

**Example Response**:
```json
{
  "policy_id": "sla-critical-default",
  "name": "Critical Priority SLA",
  "description": "Standard SLA for critical priority cases requiring immediate attention",
  "priority_level": "critical",
  "response_time_hours": 1.0,
  "resolution_time_hours": 4.0,
  "business_hours_only": false,
  "escalation_rules": {
    "75": {
      "notify": ["assignee", "team_lead"],
      "channels": ["ui", "email"]
    },
    "90": {
      "notify": ["assignee", "team_lead", "manager"],
      "channels": ["ui", "email", "slack"]
    },
    "100": {
      "notify": ["assignee", "team_lead", "manager", "director"],
      "channels": ["ui", "email", "slack", "pagerduty"]
    }
  },
  "notification_thresholds": [75, 90, 100],
  "is_active": true,
  "is_default": true,
  "created_at": "2024-01-15T10:00:00",
  "updated_at": "2024-01-15T10:00:00"
}
```

---

### 3. Create New SLA Policy

Create a new SLA policy.

**Endpoint**: `POST /api/sla-policies`

**Request Body**:
```json
{
  "policy_id": "sla-vip-critical",
  "name": "VIP Critical Priority SLA",
  "description": "Enhanced SLA for VIP customers with critical issues",
  "priority_level": "critical",
  "response_time_hours": 0.5,
  "resolution_time_hours": 2.0,
  "business_hours_only": false,
  "escalation_rules": {
    "75": {
      "notify": ["assignee", "team_lead", "vip_manager"],
      "channels": ["ui", "email", "slack", "sms"]
    },
    "90": {
      "notify": ["assignee", "team_lead", "vip_manager", "director"],
      "channels": ["ui", "email", "slack", "pagerduty"]
    },
    "100": {
      "notify": ["all_leadership"],
      "channels": ["ui", "email", "slack", "pagerduty"],
      "create_incident": true,
      "escalate_priority": true
    }
  },
  "notification_thresholds": [50, 75, 90, 100],
  "is_active": true,
  "is_default": false
}
```

**Field Descriptions**:
- `policy_id` (string, required): Unique identifier for the policy
- `name` (string, required): Human-readable policy name
- `description` (string, optional): Policy description
- `priority_level` (string, required): One of: critical, high, medium, low
- `response_time_hours` (float, required): Hours allowed for initial response (must be > 0)
- `resolution_time_hours` (float, required): Hours allowed for resolution (must be > response_time_hours)
- `business_hours_only` (boolean, optional, default: true): Whether to count only business hours
- `escalation_rules` (object, optional): Escalation rules per threshold (see format below)
- `notification_thresholds` (array[int], optional, default: [75, 90, 100]): Percentage thresholds for notifications
- `is_active` (boolean, optional, default: true): Whether policy is active
- `is_default` (boolean, optional, default: false): Whether this is the default policy for its priority level

**Escalation Rules Format** (illustrative only):

`escalation_rules` is stored as an opaque JSON object (`Optional[dict]`); the API does not validate or enforce the subfields below, and no code consumes them as a schema. The format shown is an example convention, not a validated format:

```json
{
  "threshold_percent": {
    "notify": ["role1", "role2"],
    "channels": ["ui", "email", "slack", "teams", "pagerduty"],
    "reassign_if_no_response": true,
    "escalate_priority": true,
    "create_incident": true,
    "auto_escalate": "senior_team"
  }
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:6987/api/sla-policies" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "sla-vip-critical",
    "name": "VIP Critical Priority SLA",
    "priority_level": "critical",
    "response_time_hours": 0.5,
    "resolution_time_hours": 2.0,
    "business_hours_only": false,
    "is_active": true,
    "is_default": false
  }'
```

**Validation Rules**:
- Policy ID must be unique
- Priority level must be one of: critical, high, medium, low
- Response time must be greater than 0
- Resolution time must be greater than response time
- If setting as default, other default policies for the same priority will be unset

**Success Response** (200 OK):
```json
{
  "policy_id": "sla-vip-critical",
  "name": "VIP Critical Priority SLA",
  ...
}
```

**Error Responses**:
```json
// 400 - Policy ID already exists
{
  "detail": "Policy with ID sla-vip-critical already exists"
}

// 400 - Invalid priority level
{
  "detail": "Invalid priority level. Must be one of: ['critical', 'high', 'medium', 'low']"
}

// 400 - Invalid time values
{
  "detail": "Response time must be less than resolution time"
}
```

---

### 4. Update SLA Policy

Update an existing SLA policy. Only provided fields will be updated.

**Endpoint**: `PUT /api/sla-policies/{policy_id}`

**Path Parameters**:
- `policy_id` (string, required): The policy ID to update

**Request Body** (all fields optional):
```json
{
  "name": "Updated Policy Name",
  "description": "Updated description",
  "response_time_hours": 1.5,
  "resolution_time_hours": 6.0,
  "business_hours_only": true,
  "escalation_rules": {...},
  "notification_thresholds": [75, 90, 100],
  "is_active": false,
  "is_default": true
}
```

**Example Request**:
```bash
curl -X PUT "http://localhost:6987/api/sla-policies/sla-critical-default" \
  -H "Content-Type: application/json" \
  -d '{
    "response_time_hours": 0.75,
    "resolution_time_hours": 3.0,
    "notification_thresholds": [60, 80, 95, 100]
  }'
```

**Success Response** (200 OK):
```json
{
  "policy_id": "sla-critical-default",
  "name": "Critical Priority SLA",
  "response_time_hours": 0.75,
  "resolution_time_hours": 3.0,
  "notification_thresholds": [60, 80, 95, 100],
  ...
}
```

**Error Responses**:
```json
// 404 - Policy not found
{
  "detail": "SLA policy not found"
}

// 400 - Validation error
{
  "detail": "Response time must be less than resolution time"
}
```

---

### 5. Delete SLA Policy

Delete an SLA policy. Deletion is refused if any case still references the policy; there is no `force` option. To retire a policy that is still referenced, deactivate it instead with `PUT /api/sla-policies/{policy_id}` and `is_active: false` — no new case will take it, and the cases that used it keep their SLA history.

**Endpoint**: `DELETE /api/sla-policies/{policy_id}`

**Path Parameters**:
- `policy_id` (string, required): The policy ID to delete

**Example Request**:
```bash
curl -X DELETE "http://localhost:6987/api/sla-policies/sla-old-policy"
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "SLA policy sla-old-policy deleted successfully"
}
```

**Error Responses**:
```json
// 404 - Policy not found
{
  "detail": "SLA policy not found"
}

// 409 - Policy still referenced by cases
{
  "detail": "Cannot delete an SLA policy that cases still reference (5 case(s)). Deactivate it instead with PUT /api/sla-policies/sla-old-policy (is_active=false): no new case will take it, and the cases that used it keep their SLA history."
}
```

---

### 6. Set Default Policy

Set a policy as the default for its priority level. Automatically unsets other defaults for the same priority.

**Endpoint**: `POST /api/sla-policies/{policy_id}/set-default`

**Path Parameters**:
- `policy_id` (string, required): The policy ID to set as default

**Example Request**:
```bash
curl -X POST "http://localhost:6987/api/sla-policies/sla-vip-critical/set-default"
```

**Success Response** (200 OK):
```json
{
  "policy_id": "sla-vip-critical",
  "name": "VIP Critical Priority SLA",
  "is_default": true,
  ...
}
```

---

### 7. Get Policy Usage Statistics

Get usage statistics for an SLA policy.

**Endpoint**: `GET /api/sla-policies/{policy_id}/usage`

**Path Parameters**:
- `policy_id` (string, required): The policy ID

**Query Parameters**:
- `since` (datetime, optional): Count only cases whose SLA was created at or after this time

**Example Request**:
```bash
curl -X GET "http://localhost:6987/api/sla-policies/sla-critical-default/usage"
```

**Example Response**:
```json
{
  "policy_id": "sla-critical-default",
  "policy_name": "Critical Priority SLA",
  "total_cases": 150,
  "active_cases": 23,
  "breached_cases": 8,
  "compliance_rate": 94.67,
  "is_active": true,
  "is_default": true,
  "restricted_not_counted": 0
}
```

---

### 8. Get Cases Using Policy

Get all cases that are using a specific SLA policy.

**Endpoint**: `GET /api/sla-policies/{policy_id}/cases`

**Path Parameters**:
- `policy_id` (string, required): The policy ID

**Query Parameters**:
- `status` (string, optional): Filter by case status
- `breached_only` (boolean, optional, default: false): Only return breached cases

**Example Request**:
```bash
# Get all cases using policy
curl -X GET "http://localhost:6987/api/sla-policies/sla-critical-default/cases"

# Get only breached cases
curl -X GET "http://localhost:6987/api/sla-policies/sla-critical-default/cases?breached_only=true"

# Get open cases
curl -X GET "http://localhost:6987/api/sla-policies/sla-critical-default/cases?status=open"
```

**Example Response**:
```json
{
  "policy_id": "sla-critical-default",
  "cases": [
    {
      "case_id": "CASE-001",
      "title": "Critical System Outage",
      "priority": "critical",
      "status": "open",
      "created_at": "2024-01-20T14:30:00",
      ...
    }
  ],
  "total": 1,
  "restricted_not_counted": 0
}
```

---

## Common Use Cases

### Use Case 1: Create a Custom SLA for VIP Customers

```bash
curl -X POST "http://localhost:6987/api/sla-policies" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "sla-vip-high",
    "name": "VIP High Priority SLA",
    "description": "Enhanced SLA for VIP customers",
    "priority_level": "high",
    "response_time_hours": 1.0,
    "resolution_time_hours": 4.0,
    "business_hours_only": false,
    "notification_thresholds": [50, 75, 90, 100],
    "is_active": true,
    "is_default": false
  }'
```

### Use Case 2: Update Business Hours Setting

```bash
curl -X PUT "http://localhost:6987/api/sla-policies/sla-medium-default" \
  -H "Content-Type: application/json" \
  -d '{
    "business_hours_only": false
  }'
```

### Use Case 3: Find Which Policy to Use for New Cases

```bash
# Get default policy for each priority level
curl -X GET "http://localhost:6987/api/sla-policies?default_only=true"
```

### Use Case 4: Check Policy Performance

```bash
# Get usage statistics
curl -X GET "http://localhost:6987/api/sla-policies/sla-critical-default/usage"

# Get breached cases
curl -X GET "http://localhost:6987/api/sla-policies/sla-critical-default/cases?breached_only=true"
```

### Use Case 5: Deactivate Old Policy

```bash
# First, check if it's in use
curl -X GET "http://localhost:6987/api/sla-policies/sla-old-policy/usage"

# Deactivate instead of delete
curl -X PUT "http://localhost:6987/api/sla-policies/sla-old-policy" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

---

## Integration with Case Management

### Automatic SLA Assignment

When a case is created, an SLA policy is automatically assigned based on the case priority:

```bash
# Create case (SLA auto-assigned)
curl -X POST "http://localhost:6987/api/cases" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Security Incident",
    "priority": "critical",
    "finding_ids": ["FIND-001"],
    "description": "Critical security incident requiring immediate attention"
  }'
```

The system will:
1. Create the case
2. Look up the default SLA policy for "critical" priority
3. Automatically assign that policy to the case
4. Calculate response and resolution deadlines

### Manual SLA Override

To assign a specific SLA policy to a case:

```bash
curl -X POST "http://localhost:6987/api/cases/CASE-001/sla" \
  -H "Content-Type: application/json" \
  -d '{
    "sla_policy_id": "sla-vip-critical"
  }'
```

**Error Responses**:

- `404` — No such case: `Case {case_id} not found`
- `404` — Policy not found: `SLA policy {policy_id} not found`
- `409` — Policy retired/deactivated: the named policy is deactivated, so no new case takes it; name an active policy or reactivate it
- `409` — No default policy: `No active default SLA policy exists for this case's priority.` (when no `sla_policy_id` is given and no active default exists)

---

## Best Practices

### 1. Policy Naming Convention
Use descriptive names that indicate:
- Priority level
- Special characteristics (VIP, after-hours, etc.)
- Time expectations

**Good Examples**:
- `sla-critical-default`
- `sla-vip-high-24x7`
- `sla-medium-business-hours`

**Bad Examples**:
- `policy1`
- `fast-sla`
- `test-policy`

### 2. Default Policies
- Always maintain one default policy per priority level
- Don't delete default policies without replacing them
- Test new policies before setting them as default

### 3. Escalation Rules
- Define clear escalation paths
- Include multiple notification channels for higher thresholds
- Document who receives notifications at each level

### 4. Testing New Policies
1. Create policy with `is_default: false`
2. Manually assign to test cases
3. Monitor performance for 1-2 weeks
4. Set as default if successful

### 5. Policy Lifecycle
1. **Create**: Start with conservative time estimates
2. **Monitor**: Track compliance rates and breaches
3. **Adjust**: Fine-tune based on actual performance
4. **Retire**: Deactivate instead of deleting to preserve history

---

## Error Handling

### Common Errors

**400 Bad Request**
- Invalid time values (response >= resolution)
- Invalid priority level
- Duplicate policy ID

**404 Not Found**
- Policy ID doesn't exist

**409 Conflict**
- Policy still referenced by cases (deletion refused; deactivate the policy instead)

**500 Internal Server Error**
- Database connection issues
- Unexpected server errors

### Error Response Format
```json
{
  "detail": "Descriptive error message"
}
```

---

## Rate Limits

No SLA-specific rate limits are defined for these endpoints.

---

## Changelog

### 1.1.4
- Permission gating (`cases.read` / `cases.write`), restricted-case
  counting (`restricted_not_counted`), the `since` usage parameter, and
  the 409-on-delete rule are documented on this page

### Initial release
- Initial release of SLA Policy Management API
- Full CRUD operations for policies
- Usage statistics endpoint
- Policy-to-cases mapping
- Automatic SLA assignment on case creation

---

## Support

For questions or issues:
- SLA API reference: `/docs/sla-api/`
- SLA usage guide: `/docs/sla-usage/`
- SLA quick reference: `/docs/sla-quick-reference/`
- File issues in the project repository

---

## Related Endpoints

- **Case SLA Management**: `/api/cases/{case_id}/sla`
- **SLA Metrics Summary**: `/api/v1/cases/metrics/summary`
- **Breached Cases**: `/api/v1/cases/metrics/breached`
- **Case Templates**: `/api/cases/templates`, a template may name an SLA policy; on assignment from a template a retired/deactivated policy falls back to the active default policy for the case's priority (with the fallback logged), it is not refused. A direct assignment naming a retired policy is refused with 409 and the typed outcome (`POLICY_RETIRED`).
{% endraw %}
