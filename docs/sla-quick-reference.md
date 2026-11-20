---
layout: docs
title: "SLA Quick Reference"
permalink: /docs/sla-quick-reference/
---

{% raw %}
## ✨ Automatic SLA Assignment

**Good News!** SLA is auto-assigned from the active default policy for the case's priority, if one exists, when you create a case. If no active default policy exists for that priority, the case is still created, but with no SLA assigned.

```bash
# Create case → SLA auto-assigned from the active default policy for its priority, if one exists
# (prefer the versioned spelling /api/v1/cases for external scripts; /api/cases is its legacy mount)
curl -X POST http://localhost:6987/api/cases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"Issue","priority":"high","finding_ids":[]}'
```

## 📋 Example Policies

No default policies are seeded or shipped pre-configured; policies are created through the API. The values below are an example set you can start from:

| Priority | Response | Resolution | Coverage |
|----------|----------|------------|----------|
| Critical | 1h | 4h | 24/7 |
| High | 2h | 8h | 24/7 |
| Medium | 4h | 24h | Business hours |
| Low | 8h | 72h | Business hours |

## 🔧 Common Operations

### Check SLA Status
```bash
GET /api/cases/{case_id}/sla
```

### Assign SLA
```bash
POST /api/cases/{case_id}/sla
{"sla_policy_id": "sla-high-default"}  # or {} for default
```

Re-POSTing does not replace an existing SLA: if the case already has an SLA assigned, the existing SLA is returned unchanged. The policy ID must be one that exists (one an operator created — no policies are seeded); an unknown ID returns 404.

### Pause SLA
```bash
POST /api/cases/{case_id}/sla/pause
```

### Resume SLA
```bash
POST /api/cases/{case_id}/sla/resume
```

## 🎛️ Policy Management

### List Policies
```bash
GET /api/sla-policies/
GET /api/sla-policies/?active_only=true
GET /api/sla-policies/?priority_level=high&default_only=true
```

### Create Policy
```bash
POST /api/sla-policies/
{
  "policy_id": "sla-custom",
  "name": "Custom Policy",
  "priority_level": "high",
  "response_time_hours": 1.5,
  "resolution_time_hours": 6.0,
  "business_hours_only": false
}
```

### Update Policy
```bash
PUT /api/sla-policies/{policy_id}
{"response_time_hours": 2.0}
```

### Delete Policy
```bash
DELETE /api/sla-policies/{policy_id}
```

There is no force delete. Deleting a policy that cases still reference is refused with 409. To retire an in-use policy, deactivate it instead:

```bash
PUT /api/sla-policies/{policy_id}
{"is_active": false}
```

### Set as Default
```bash
POST /api/sla-policies/{policy_id}/set-default
```

### Get Usage Stats
```bash
GET /api/sla-policies/{policy_id}/usage
```

## 💻 Frontend (TypeScript)

### Import
```typescript
import { casesApi, slaPoliciesApi } from '@/services/api'
```

### Check SLA
```typescript
const sla = await casesApi.getSLA(caseId)
console.log(sla.data.health_status)  // healthy, warning, critical, breached
```

### Assign SLA

There is no `casesApi.assignSLA` helper. Call the REST endpoint directly:

```bash
POST /api/cases/{case_id}/sla
{"sla_policy_id": "sla-high-default"}  # or {} for default
```

### Pause/Resume

There are no `casesApi.pauseSLA` or `casesApi.resumeSLA` helpers. Call the REST endpoints directly:

```bash
POST /api/cases/{case_id}/sla/pause
POST /api/cases/{case_id}/sla/resume
```

### Manage Policies
```typescript
// List
const policies = await slaPoliciesApi.getAll({ active_only: true })

// Create
await slaPoliciesApi.create({
  policy_id: 'sla-custom',
  name: 'Custom',
  priority_level: 'high',
  response_time_hours: 1,
  resolution_time_hours: 4
})

// Update
await slaPoliciesApi.update('sla-custom', { response_time_hours: 2 })

// Usage
const usage = await slaPoliciesApi.getUsage('sla-high-default')
```

### SLA UI

There is no per-case `CaseSLA` component. SLA policies are managed in the settings screen's SLA policies section (`SlaPoliciesSection`).

## 🚦 Health Status

- 🟢 **healthy**: < 75% elapsed
- 🟡 **warning**: 75-89% elapsed  
- 🟠 **critical**: 90-99% elapsed
- 🔴 **breached**: past the response or resolution deadline and not completed

## 🧪 Testing

```bash
# Test API (the endpoint requires authentication and the cases.read
# permission — without the header this is only a reachability check and
# returns an auth error, not a policy list)
curl http://localhost:6987/api/sla-policies/ \
  -H "Authorization: Bearer <token>"
```

## 📚 Full Documentation

- **Usage Guide**: [SLA Usage Guide](/docs/sla-usage/)
- **API Reference**: [SLA Policy API](/docs/sla-api/)

## 🆘 Troubleshooting

**SLA not assigned?**
```bash
# Check default policies exist
curl http://localhost:6987/api/sla-policies/?default_only=true
```

**Check logs:**
```bash
tail -f logs/backend.log | grep SLA
```

---

**Version**: 1.1.4 | **Updated**: 2026-11-19
{% endraw %}
