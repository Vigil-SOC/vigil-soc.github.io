---
layout: docs
title: "VStrike Kill Chain MCP"
permalink: /docs/integrations/vstrike-killchain/
---

{% raw %}
> **Status: PROPOSED — external request, not shipped behaviour.**
> This page is the request to the CloudCurrent / VStrike engineering team
> for a new MCP tool, `ui-killchain-replay`, that would let Vigil drive
> kill-chain replays through the VStrike UI. The tool definition, step
> schema, and defaults below are the proposed VStrike-side specification;
> they are not a description of behaviour shipped in Vigil 1.1.4. The
> shipped status is stated in the next section.

## Shipped status at Vigil 1.1.4

What exists on the Vigil side:

- The MCP client method `killchain_replay_in_ui` exists in
  `core/integrations/vstrike/client.py` (lines 576–622). It forwards
  caller-supplied arguments to `_call_mcp_tool("ui-killchain-replay", …)`
  — see "MCP tools" below.
- That method has **zero callers** in `core/`, `services/`, or
  `clients/`. Nothing in Vigil walks a case's findings, dedupes by asset,
  or builds a step list for it, and the client passes `steps` through
  without validating their contents.
- If the VStrike server has not shipped the tool, the method raises
  `VStrikeToolNotImplemented` with the exact message: "VStrike server
  does not yet implement ui-killchain-replay. Update the VStrike MCP
  server to a version that ships the kill-chain tool."
  (`core/integrations/vstrike/client.py:618-622`, on a `-32601` /
  "method not found" / "tool not found" / "unknown tool" error.)

What does **not** exist at 1.1.4:

- No Vigil REST route for kill-chain replay — see the complete REST
  route list below.
- No frontend Play button, iframe toolbar, or iframe host component.
  There is no `clients/web/src/components/graph/` directory and no
  `VStrikeIframeHost.tsx` anywhere under `clients/`. VStrike also
  appears in the web UI source as integration configuration (for
  example in `clients/web/src/config/integrations.ts`); the embedded
  panel itself is only noted in
  `clients/web/src/screens/dashboard/FindingPopup.tsx`, which notes
  that the embedded VStrike `NetworkContextPanel` is "deliberately not
  ported: it needs the VStrike provider, which isn't mounted under the
  console shell."

Further Vigil-side code — a caller that builds the step list, a REST
route, and a UI surface — would therefore be required before an analyst
could use this replay, even once VStrike ships the tool.

## Why we need this

When a Vigil analyst opens a case enriched by VStrike, every finding's
`entity_context.vstrike` carries an `attack_path` (an ordered list of
asset IDs from initial access to the target) plus `adjacent_assets` (the
MITRE technique on each edge) —
`core/integrations/vstrike/schemas.py:45-50`, with the per-edge
technique on `VStrikeAdjacentAsset.edge_technique` (`schemas.py:26-30`).
There is currently no way to replay that kill chain across those nodes
as an animated sequence.

The request is for one MCP tool: Vigil's client would send VStrike a
step list, and VStrike would animate that sequence — highlighting each
node, drawing edges as transitions, surfacing the MITRE technique
labels. As described in the client, VStrike pushes the animation to
its active UI session over its own WebSocket, with no iframe reload.

This pattern follows the existing `ui-network-load` tool — same auth
(JWT via `/mcp-login`), same JSON-RPC transport at VStrike's `/mcp`
endpoint, same SSE response framing, same session-state assumption
(the VStrike UI session is already open and authenticated).

## Vigil REST API (shipped) — separate from MCP

Vigil's own REST router for VStrike is
`services/api/routers/vstrike.py`, under the prefix
`/api/integrations/vstrike` (`ROUTER_META`, lines 42–43). It defines
exactly three routes, none of which is a kill-chain replay route:

| Method and path | Handler | Purpose |
|---|---|---|
| `POST /api/integrations/vstrike/findings` | `ingest_findings` (`:109`, on `router`) | Receive a batch of VStrike-enriched findings pushed to Vigil |
| `GET /api/integrations/vstrike/health` | `health_check` (`:264`, on `authenticated_router`) | Check outbound connectivity to the configured VStrike server |
| `GET /api/integrations/vstrike/topology/asset/{asset_id}` | `get_asset_topology` (`:287`, on `authenticated_router`) | Proxy to the VStrike asset-topology lookup for one asset |

The kill-chain payload in the curl example below is **not** sent via
any of these routes. The Vigil MCP client sends it directly to
VStrike's `/mcp` endpoint.

## MCP tools (VStrike server) — separate from REST

Vigil's client, `core/integrations/vstrike/client.py`, calls tools on
VStrike's MCP server by JSON-RPC `tools/call` at `MCP_RPC_PATH = "/mcp"`
(`client.py:50`; `_call_mcp_tool` at `:421`), using JWT auth obtained
via `/mcp-login`. Relevant client methods:

| MCP tool | Vigil client method | Status |
|---|---|---|
| `ui-network-load` | `load_network_in_ui` (`client.py:568-574`), called with `{"networkId": network_id}` | Existing pattern this request borrows from |
| `ui-killchain-replay` | `killchain_replay_in_ui` (`client.py:576-622`) | Client method implemented; zero callers; depends on the VStrike server shipping the tool |
| `network-list` | `list_networks` (`client.py:562-565`) | Existing |
| `node-search` | `node_search` (`client.py:634`) | Existing |
| `node-drift-get` | `node_drift_get` (`client.py:648`) | Existing |

There is no `node-list` tool referenced by the Vigil client.

For `ui-killchain-replay`, the only argument names and defaults with a
Vigil code counterpart are those the client actually sends
(`client.py:576-603`): `networkId`, `steps`, `loop` (default `False`),
and `auto_play` (default `True`).

## Proposed tool definition

The following is the **proposed** VStrike-side specification. Values
that appear only here — for example the `dwell_ms` default of 2000,
`minItems: 1`, the required step fields `["node_id", "timestamp"]`, and
`execution.taskSupport: "forbidden"` — have no Vigil code counterpart:
the client passes `steps` through unvalidated (`client.py:595-603`).

```jsonc
{
  "name": "ui-killchain-replay",
  "description": "Animate a kill-chain through the active VStrike UI session. The iframe receives a WebSocket message and walks the supplied step sequence — highlighting each node, drawing edges as transitions, and surfacing MITRE technique labels.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "networkId": {
        "type": "string",
        "description": "The network identifier to load before stepping. The tool MUST internally do a `ui-network-load` if the active session is on a different network."
      },
      "steps": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "properties": {
            "node_id":   { "type": "string",  "description": "Asset ID to highlight at this step. Must exist in networkId." },
            "timestamp": { "type": "string",  "description": "ISO-8601 timestamp of the originating event. Surfaced as a label." },
            "technique": { "type": "string",  "description": "Optional MITRE ATT&CK ID for the EDGE leading into this node (e.g. T1021.002)." },
            "label":     { "type": "string",  "description": "Optional human-readable annotation to display alongside the node during dwell." },
            "dwell_ms":  { "type": "integer", "description": "Optional per-step dwell override; default 2000 ms." }
          },
          "required": ["node_id", "timestamp"]
        }
      },
      "loop":      { "type": "boolean", "description": "If true, restart from step 0 after the last step (default false)." },
      "auto_play": { "type": "boolean", "description": "If false, the steps are loaded but playback does not start automatically (default true)." }
    },
    "required": ["networkId", "steps"]
  },
  "execution": { "taskSupport": "forbidden" }
}
```

### Patterns this borrows from `ui-network-load`

- **WebSocket push to the active session.** No iframe reload. Single tool
  call per replay. The MCP tool itself is stateless — VStrike's UI side
  consumes the message and animates.
- **Stateless server-side.** No per-replay session record. The MCP tool
  just routes the steps to whichever VStrike UI session matches the
  caller's JWT.
- **Returns a `content` text confirmation.** Same shape as the existing
  `ui-network-load` response — JSON-RPC `result.content[].text`, with
  `isError` as the failure signal so Vigil's existing extractor works
  unchanged.

## Open questions

These don't block shipping the tool, but they affect what the user sees:

1. **Edge animations.** Does the VStrike UI already render edge animations
   between sequential nodes? If not, the kill-chain replay would step one
   node at a time without showing the link visualization the analyst
   wants. Vigil's UX assumption is that VStrike draws the edge into each
   highlighted node. If that doesn't exist today, can it ship alongside
   the MCP tool?

2. **Playback-finished event.** Can the VStrike UI send a "playback
   finished" message back over its existing WebSocket? Bidirectional
   channel — nice-to-have, not a blocker. No Vigil component currently
   exists to consume such an event (there is no `EventTimeline`
   component in `clients/web/src`, `core/`, or `services/` at 1.1.4),
   so consuming it would require new Vigil-side work; without it, a
   dwell-sum estimate on Vigil's side remains an option.

3. **`node_id` format.** Vigil's findings carry asset identifiers that
   we believe match the identifiers returned by the tools the Vigil
   client actually uses — `network-list`, `node-search`, and
   `node-drift-get` (the `id` / `network_id` / `uuid` field, in that
   priority order). Please confirm. The Vigil client references no
   `node-list` tool.

## Curl example — what the Vigil client sends to VStrike

This is what a real call looks like once the tool ships. It is the
payload the Vigil MCP client method `killchain_replay_in_ui` sends
directly to VStrike's `/mcp` endpoint as a `tools/call` JSON-RPC
request — it does not go through any Vigil REST endpoint:

```bash
curl -X POST 'https://vstrike.example/mcp' \
  -H "Authorization: Bearer ${VSTRIKE_JWT}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1730000000000,
    "method": "tools/call",
    "params": {
      "name": "ui-killchain-replay",
      "arguments": {
        "networkId": "net-123",
        "steps": [
          { "node_id": "asset-001", "timestamp": "2026-04-28T11:00:00Z", "label": "Initial Access" },
          { "node_id": "asset-042", "timestamp": "2026-04-28T11:05:00Z", "technique": "T1021.002", "label": "Lateral movement → file-server" },
          { "node_id": "asset-077", "timestamp": "2026-04-28T11:12:00Z", "technique": "T1003.001", "label": "Target: domain-controller" }
        ],
        "loop": false,
        "auto_play": true
      }
    }
  }'
```

Expected success response (SSE-framed JSON-RPC, matching `ui-network-load`):

```
event: message
data: {"jsonrpc":"2.0","id":1730000000000,"result":{"content":[{"type":"text","text":"Replay queued: 3 steps, network net-123"}],"isError":false}}
```

## Contact

Direct questions about the Vigil-side implementation to:
- Vigil repo: <https://github.com/Vigil-SOC/vigil>
- Tool client lives in [`core/integrations/vstrike/client.py`](https://github.com/Vigil-SOC/vigil/blob/main/core/integrations/vstrike/client.py) (see
  `killchain_replay_in_ui`)
- Vigil REST API surface: [`services/api/routers/vstrike.py`](https://github.com/Vigil-SOC/vigil/blob/main/services/api/routers/vstrike.py)
  — `POST /api/integrations/vstrike/findings`,
  `GET /api/integrations/vstrike/health`, and
  `GET /api/integrations/vstrike/topology/asset/{asset_id}` only; there
  is no kill-chain replay route
{% endraw %}
