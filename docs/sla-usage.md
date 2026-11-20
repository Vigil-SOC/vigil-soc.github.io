---
layout: docs
title: "SLA Usage Guide"
permalink: /docs/sla-usage/
---

{% raw %}
## Overview

This guide shows you how to add and manage SLA (Service Level Agreements) for cases in Vigil.

All SLA and case endpoints require authentication. The `curl` examples below include an `Authorization: Bearer <token>` header; the web UI calls the same endpoints with its signed-in session.

## Automatic SLA Assignment ✨

**Good News!** SLA is **automatically assigned** when you create a case — provided an active default policy exists for the case's priority.

### How It Works

1. **Create a case** with any priority (critical, high, medium, low)
2. **SLA is automatically assigned** based on the default policy for that priority
3. **Countdown starts immediately** from case creation

If no active default policy exists for the priority, the case is still created, but it has no SLA until one is assigned manually (see Troubleshooting).

**Example:**
```bash
# Create a high priority case
curl -X POST "http://localhost:6987/api/cases/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Security Incident",
    "priority": "high",
    "finding_ids": ["FIND-001"],
    "description": "Critical security incident"
  }'

# SLA is automatically assigned using the default "high" priority policy,
# with the response and resolution deadlines set by that policy
```

## Example SLA Policies

Vigil does not ship with pre-configured SLA policies. Create one default policy per priority; the values below are an example set you can start from:

| Priority | Response Time | Resolution Time | Coverage |
|----------|---------------|-----------------|----------|
| Critical | 1 hour | 4 hours | 24/7 |
| High | 2 hours | 8 hours | 24/7 |
| Medium | 4 hours | 24 hours | Business hours |
| Low | 8 hours | 72 hours | Business hours |

Note: a newly created policy defaults to `business_hours_only: true` unless you set it to `false`.

## Manual SLA Assignment

If you need to override the automatic assignment:

### Via API

```bash
# Assign specific SLA policy to a case
curl -X POST "http://localhost:6987/api/cases/CASE-001/sla" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sla_policy_id": "sla-vip-critical"
  }'

# Or use default for priority (same as automatic)
curl -X POST "http://localhost:6987/api/cases/CASE-001/sla" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Via Frontend (TypeScript/React)

There is no `casesApi` helper for assigning an SLA — call the REST endpoint directly:

```typescript
// Assign SLA to case
const assignSLA = async (caseId: string) => {
  try {
    // Use default policy for case priority
    await fetch(`/api/cases/${caseId}/sla`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })

    // Or specify a policy
    await fetch(`/api/cases/${caseId}/sla`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sla_policy_id: 'sla-vip-critical' })
    })

    console.log('SLA assigned successfully')
  } catch (error) {
    console.error('Failed to assign SLA:', error)
  }
}
```

## Checking SLA Status

### Via API

```bash
# Get SLA status for a case
curl -X GET "http://localhost:6987/api/cases/CASE-001/sla" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "case_id": "CASE-001",
  "sla_policy_id": "sla-high-default",
  "response_due": "2026-01-20T16:30:00",
  "resolution_due": "2026-01-21T00:30:00",
  "response_remaining_seconds": 3600,
  "resolution_remaining_seconds": 25200,
  "response_percent_elapsed": 50.0,
  "resolution_percent_elapsed": 12.5,
  "response_completed": false,
  "resolution_completed": false,
  "response_sla_met": null,
  "resolution_sla_met": null,
  "is_breached": false,
  "breach_type": null,
  "is_paused": false,
  "health_status": "healthy"
}
```

If the case has no SLA assigned, this endpoint returns `null` instead of a status object.

### Via Frontend

```typescript
import { casesApi } from '@/services/api'

// Get SLA status
const checkSLA = async (caseId: string) => {
  try {
    const response = await casesApi.getSLA(caseId)
    const sla = response.data

    // sla is null when the case has no SLA assigned
    if (!sla) {
      console.log('No SLA assigned to this case')
      return
    }

    console.log(`Health: ${sla.health_status}`)
    console.log(`Response: ${sla.response_percent_elapsed}% elapsed`)
    console.log(`Resolution: ${sla.resolution_percent_elapsed}% elapsed`)

    if (sla.is_breached) {
      console.warn(`SLA BREACHED: ${sla.breach_type}`)
    }
  } catch (error) {
    console.error('Failed to get SLA:', error)
  }
}
```

## SLA Health Status

The system automatically calculates health status:

- **🟢 healthy**: < 75% of time elapsed
- **🟡 warning**: 75-89% of time elapsed
- **🟠 critical**: 90-99% of time elapsed
- **🔴 breached**: the case is breached — the effective (pause-adjusted) deadline has passed. Percent-elapsed values are capped at 100 and frozen while paused or completed, so breached is a deadline test, not a "100%+ elapsed" reading

## Pausing and Resuming SLA

Sometimes you need to pause the SLA clock (waiting for customer, external dependency, etc.):

### Via API

```bash
# Pause SLA
curl -X POST "http://localhost:6987/api/cases/CASE-001/sla/pause" \
  -H "Authorization: Bearer <token>"

# Resume SLA
curl -X POST "http://localhost:6987/api/cases/CASE-001/sla/resume" \
  -H "Authorization: Bearer <token>"
```

### Via Frontend

There are no `casesApi` helpers for pause/resume — call the REST endpoints directly:

```typescript
// Pause SLA
await fetch(`/api/cases/${caseId}/sla/pause`, { method: 'POST' })

// Resume SLA
await fetch(`/api/cases/${caseId}/sla/resume`, { method: 'POST' })
```

**Important Notes:**
- When paused, the SLA timer stops
- Deadlines are automatically extended by the pause duration when resumed
- Total pause time is tracked for reporting

## Managing SLA Policies

### List All Policies

```bash
# Get all active policies
curl -X GET "http://localhost:6987/api/sla-policies/?active_only=true" \
  -H "Authorization: Bearer <token>"

# Get default policies only
curl -X GET "http://localhost:6987/api/sla-policies/?default_only=true" \
  -H "Authorization: Bearer <token>"

# Get policies for specific priority
curl -X GET "http://localhost:6987/api/sla-policies/?priority_level=high" \
  -H "Authorization: Bearer <token>"
```

### Create Custom Policy

```bash
curl -X POST "http://localhost:6987/api/sla-policies/" \
  -H "Authorization: Bearer <token>" \
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

Note: `notification_thresholds` is stored on the policy, but nothing currently acts on it — setting custom thresholds does not produce notifications. When the field is omitted, the server stores the default `[75, 90, 100]`.

### Update Policy

```bash
curl -X PUT "http://localhost:6987/api/sla-policies/sla-high-default" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "response_time_hours": 1.5,
    "resolution_time_hours": 6.0
  }'
```

### Set as Default

```bash
# Make this the default policy for its priority level
curl -X POST "http://localhost:6987/api/sla-policies/sla-vip-high/set-default" \
  -H "Authorization: Bearer <token>"
```

## Frontend Integration

### SLA Policies Settings Screen

The web UI includes an SLA policies section in Settings for managing policies. There is no pre-built per-case SLA component; use the API helpers and REST endpoints below to work with SLA data from your own code.

### Using the SLA Policies API

```typescript
import { slaPoliciesApi } from '@/services/api'

// List all policies
const policies = await slaPoliciesApi.getAll({ active_only: true })

// Get specific policy
const policy = await slaPoliciesApi.getById('sla-high-default')

// Create new policy
await slaPoliciesApi.create({
  policy_id: 'sla-custom-001',
  name: 'Custom Policy',
  priority_level: 'high',
  response_time_hours: 1.5,
  resolution_time_hours: 6.0,
  business_hours_only: false
})

// Update policy
await slaPoliciesApi.update('sla-custom-001', {
  response_time_hours: 2.0
})

// Get usage statistics
const usage = await slaPoliciesApi.getUsage('sla-high-default')
console.log(`Compliance rate: ${usage.compliance_rate}%`)

// Get cases using this policy (no slaPoliciesApi helper exists;
// call the REST endpoint directly — it supports `status` and
// `breached_only` query parameters)
const casesResponse = await fetch(
  '/api/sla-policies/sla-high-default/cases?breached_only=true'
)
const cases = await casesResponse.json()
```

## Common Workflows

### Workflow 1: Create Case with Custom SLA

```typescript
// 1. Create the case
const caseResponse = await casesApi.create({
  title: 'VIP Customer Issue',
  priority: 'high',
  finding_ids: ['FIND-001'],
  description: 'VIP customer reported issue'
})

const caseId = caseResponse.data.case_id

// 2. Override with VIP SLA policy (REST endpoint; no casesApi helper)
await fetch(`/api/cases/${caseId}/sla`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sla_policy_id: 'sla-vip-high' })
})
```

### Workflow 2: Monitor SLA Health

```typescript
// Get all open cases
const openCases = await casesApi.getAll({
  closed: false
})

for (const caseItem of openCases.data.cases) {
  const slaResponse = await casesApi.getSLA(caseItem.case_id)
  const sla = slaResponse.data

  if (sla && sla.health_status === 'critical') {
    console.warn(`Case ${caseItem.case_id} is at risk!`)
    // Send alert, escalate, etc.
  }
}
```

### Workflow 3: Pause During External Wait

```typescript
// Customer needs to provide information
await casesApi.addComment(caseId, {
  content: 'Waiting for customer response'
})

// Pause SLA while waiting (REST endpoint; no casesApi helper)
await fetch(`/api/cases/${caseId}/sla/pause`, { method: 'POST' })

// Later, when customer responds...
await casesApi.addComment(caseId, {
  content: 'Customer provided requested information'
})

// Resume SLA (REST endpoint; no casesApi helper)
await fetch(`/api/cases/${caseId}/sla/resume`, { method: 'POST' })
```

## Troubleshooting

### SLA Not Assigned Automatically

**Check:**
1. Is there a default policy for the case priority?
   ```bash
   curl -X GET "http://localhost:6987/api/sla-policies/?priority_level=high&default_only=true" \
     -H "Authorization: Bearer <token>"
   ```

2. Check backend logs for errors:
   ```bash
   tail -f logs/backend.log | grep SLA
   ```

### SLA Assignment Failed

**Common causes:**
- No default policy exists for the priority level
- Policy is inactive (`is_active: false`)
- Database connection issue

**Solution:**
```bash
# Create or activate a default policy
curl -X PUT "http://localhost:6987/api/sla-policies/sla-high-default" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"is_active": true, "is_default": true}'
```

### SLA Shows as Breached Immediately

**Possible causes:**
- System clock is incorrect
- Case was created in the past
- SLA policy times are too short

**Check:**
```bash
# Verify policy times
curl -X GET "http://localhost:6987/api/sla-policies/sla-high-default" \
  -H "Authorization: Bearer <token>"

# Check case creation time
curl -X GET "http://localhost:6987/api/cases/CASE-001" \
  -H "Authorization: Bearer <token>"
```

## Best Practices

### 1. Use Automatic Assignment
Let the system automatically assign SLA based on priority. Only override for special cases.

### 2. Document Pauses
Always add a comment when pausing SLA to explain why:
```typescript
await casesApi.addComment(caseId, {
  content: 'Pausing SLA - waiting for vendor response'
})
await fetch(`/api/cases/${caseId}/sla/pause`, { method: 'POST' })
```

### 3. Monitor Health Status
Set up alerts for cases with `health_status: 'critical'` to prevent breaches.

### 4. Review Policies Regularly
Check per-policy compliance rates and adjust policies:
```bash
# Get usage statistics (including compliance_rate) for a policy
curl -X GET "http://localhost:6987/api/sla-policies/sla-high-default/usage" \
  -H "Authorization: Bearer <token>"
```

### 5. Test Before Production
Always test new policies with a few cases before setting as default.

## API Reference

For complete API documentation, see:
- [SLA Policy API Guide](/docs/sla-api/)

## Support

For issues or questions:
1. Check the logs: `logs/backend.log`
2. Review the API documentation
3. Check database for policy configuration

---

**Version**: 1.1.4 | **Last Updated**: November 19, 2026
{% endraw %}
