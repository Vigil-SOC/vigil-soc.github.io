---
layout: docs
title: "LLM Layer"
permalink: /docs/llm-layer/
---

{% raw %}
Everything Vigil does with a language model on the Python side lives here.
The layering below is the point of the package: it is what tells you where a
new file goes. The `.importlinter` contracts cover part of it — the
`deployables` contract keeps `core/` from importing `services/` — but there
is no automated gate for the layer's internal boundaries (see Rule 1).

## The harness boundary

The distinction that matters is **loop vs. call**. A *router* call is one
stateless completion. The multi-turn agent loop — executing tools between
turns — no longer lives in this package at all: it lives in the TypeScript
agent service (`services/agent/`: `services/agent/core/loop.ts` defines
the `Harness` interface and `commitTurn`, and
`services/agent/core/stream.ts` exports `streamTurn`, which together
wire the loop to tool dispatch). What remains in
`core/llm/harness/` is the one-shot side of that distinction.

| Sub-package | Owns | Never does |
|---|---|---|
| `router/` | **One** stateless completion: provider selection, wire-format translation, pre-dispatch sanitization, budget VK resolution | Loop, execute tools, touch SOC domain models |
| `harness/` | One-shot Anthropic completions (`ClaudeService` in `harness/claude.py`): one completion at a time, no tools and no loop | Run the agent loop — tools and the loop live in the agent layer (`services/agent/`) |
| `providers/` | SDK client construction, the model registry, live model discovery | Know about agents or tools |
| `cost/` | Pricing math, pre-call estimation, virtual-key budget enforcement | Call an LLM |
| `bifrost/` | The only place that speaks Bifrost's admin and logging REST APIs | — |
| `gateway/` | The ARQ enqueue side in front of the router | Run the jobs it enqueues — that worker is `services/worker/` |

`harness/claude.py` does not go through the router: it constructs SDK
clients via `providers/clients.py` and dispatches directly, importing the
router's `bifrost_headers` helper for Bifrost routing headers.

Local Ollama supervision is not part of this layer at all: the supervisor is
`core/platform/ollama_supervisor.py`, which runs `ollama serve` as a host
process. `providers/` holds Ollama discovery and capability tables alongside SDK client construction and the model registry.

`security.py` (prompt-injection defenses) sits at the top level because the
router and other callers inside and outside the layer need it — among them
`system_prompt.py`, detections drafting, the daemon processor, and the API's
skills router. Other top-level modules — `chat_layers.py`, `defaults.py`,
`gateway_retry.py`, `oneshot.py`, `outage.py`, `system_prompt.py`,
`target.py`, and `tool_schemas.py` — hold shared pieces that do not belong
to any single sub-package.

## Rules

1. `router/` must not import `harness/`. The dependency runs one way. This
   rule currently has no automated gate: no import-linter contract covers
   the llm layer's internal boundaries.
2. Nothing under `core/llm/` imports `services` at module scope. Lazy
   in-function imports are the sanctioned escape hatch. The upward-import
   ban is covered generically by the import-linter `deployables` contract
   (core ↛ services).
3. `providers/registry.py` and `bifrost/admin.py` import each other lazily,
   by design: the registry imports `sync_all_provider_models` from the
   admin module inside a function, and the admin module imports registry
   helpers inside its functions. Do not hoist either import to module
   scope — it is a real cycle.
{% endraw %}
