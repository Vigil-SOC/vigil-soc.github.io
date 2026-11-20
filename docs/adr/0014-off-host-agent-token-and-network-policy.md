---
layout: docs
title: "ADR 0014: Off-host Agent Token"
permalink: /docs/adr/0014-off-host-agent-token-and-network-policy/
---

{% raw %}
Date: 2026-08-13

## Status

Accepted. **Amends ADR 0010** — keeps its guarantees, drops its loopback half.

> Status note (2026-11-19): still in force at Vigil 1.1.4; token rotation via a previous-token secret has been added since this decision was accepted.

Governs #635 (the agent image, the Helm deployment and the Node CI job).

## Context

ADR 0010 put every remote tool call through one authenticated Python endpoint,
`POST /internal/tools/invoke`, "loopback-bound **and** shared-secret
authenticated — either alone is a single point of failure." It named the
condition that would end that arrangement:

> The endpoint is high-value: it reaches every credential in the deployment.
> Loopback binding plus shared secret is the floor, not the ceiling, and it
> should be revisited if the agent service is ever deployed off-host.

#635 deploys it off-host. It makes **Agent Worker** and **Agent Serve**
independently scaling Deployments, at which point no traffic on the seam arrives
from loopback any more.

The seam is wider than the one endpoint 0010 describes. Every `/internal/*`
route on the Python side and every non-health route on agent-serve crosses
it, and the loopback predicate is written twice — `core/agents/internal_auth.py` and
`serve.ts` carry the same check under the same comment:

- Agent → Python: `/internal/tools` (`/invoke`, `/skill-reads`,
  `/skill-bodies`), `/internal/pricing`, `/internal/playbooks`,
  `/internal/runs` (phases, status, progress, terminal, children, handoff,
  findings, checkpoints, decisions)
- Python → Agent: `POST /chat/stream`, `GET /runs/<id>/projection`, and the
  other non-health agent-serve routes (plugin check, distil, narrate,
  replay, verify, events, tool call, investigation replay)

Both directions currently 403 across a pod boundary, so the parked
`agent-worker` Deployment would start, dequeue a job and fail to resolve a
playbook before its first model call.

## Decision

Drop the loopback predicate on both sides. The bearer token becomes the sole
in-process check, and reachability is constrained by the chart's NetworkPolicy
— only when that policy is enabled: `networkPolicies.enabled` defaults to
`false`, so out of the box the token is the sole control in-cluster too.

The loopback check existed because "a shared secret on a public bind is one leak
from open." NetworkPolicy, once enabled, answers that with a strictly stronger
statement: it names which pods may connect, where loopback only ever said
"same box."

Every guarantee ADR 0010 asked for is unchanged — bounds enforcement,
read-only, row and time capping, deny-by-default allow-lists, refusal semantics.
This amends where the second factor is enforced, not what is enforced.

## Consequences

- **Compose is token-only.** There is no NetworkPolicy in docker-compose, so the
  second factor there is that `deeptempo-network` is a private bridge and the
  agent services publish no ports. Defensible, but it should be described
  accurately rather than as defence in depth.
- **Failing closed on an unset token becomes load-bearing.** Both sides already
  refuse when `AGENT_INTERNAL_TOKEN` is empty — Python 503s and says the secret
  is unconfigured, the agent 401s every non-health call (its health and
  readiness endpoints answer without a token, because the kubelet has none).
  That was belt-and-braces while loopback held; it is now the only thing
  between a reachable pod and an open endpoint.
- **The bind does not change, only the check.** `serve.ts` already listens on
  all interfaces by default (the bind host is configurable via
  `AGENT_BIND_HOST`; unset keeps all interfaces); it was the check and not the
  socket that kept it closed.
- **The NetworkPolicy is less of a replacement than this decision first claimed,
  and the difference is worth stating plainly.** One edge is namespace-wide
  rather than pod-specific, and the other is pod-named but not backend-only:
  - *Agent → Python `/internal/*`*: the chart's backend policy already admits
    any pod in the namespace on the backend port, because the daemon, llm-worker
    and the helm test all use it. Narrowing it is a change to those components,
    not to this seam, so it was left alone.
  - *Backend → agent-serve*: named to the backend pods, and to Medic pods
    when Medic is enabled (`medic.enabled`, off by default) — a NetworkPolicy
    admits a port, so Medic reaches every route on this port and the token
    is the only remaining gate there. Health rides the traffic port, and
    NetworkPolicy ingress rules are OR'd, but probes do not re-open it
    namespace-wide: the only probe allowance is
    `networkPolicies.probeAllowFrom`, an opt-in list of node CIDRs admitted
    to the probe ports only, which defaults to empty — the probe rule
    renders nothing when the list is empty. Set it on a CNI that does not
    let node-sourced probes through, or probes fail and the pods restart.

  So in-cluster the honest description is the same one compose gets: **the token
  is the gate, and the network is a coarse second layer.** That is still an
  improvement on a check that refused every legitimate caller, but it is not the
  pod-level containment "constrain reachability with NetworkPolicy" implies.
- ADR 0010's "floor, not the ceiling" still stands, and this decision does not
  raise the ceiling much. mTLS or a mesh is what would actually put a
  cryptographic identity on each end, and the consequence above is the argument
  for getting there.

## Alternatives considered

**Sidecar containers in the backend pod.** Preserves the property exactly, needs
no code change, and was the only genuine alternative. Rejected because Worker and
Serve would then scale with the API — independent scaling is the point of #635,
and a queue consumer and an SSE endpoint have nothing in common in how they load.

**A configurable check** (`AGENT_TRUST_NETWORK`, or a CIDR allow-list). Strict in
dev, relaxed in production. Rejected: a security check with a bypass flag is the
leak the original comment warned about, and the flag defaults wrong somewhere
eventually.

**mTLS or a service mesh.** The right end state and a larger lift than this
ticket, with a new cluster dependency.
{% endraw %}
