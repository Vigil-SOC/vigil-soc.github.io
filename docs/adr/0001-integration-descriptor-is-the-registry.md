---
layout: docs
title: "ADR 0001: Integration Descriptor"
permalink: /docs/adr/0001-integration-descriptor-is-the-registry/
---

{% raw %}
Integration facts had drifted across five places — `mcp-config.json` keys,
descriptor `id`, descriptor `mcp_server_names`, the frontend catalog `id`, and the
snake_case key each `tools/*.py` passed to `get_integration_config()`. The drift
was not cosmetic: six of the eleven `tools/` servers read a key the UI never
writes, every `"<x>-server"` value in `INTEGRATION_TO_SERVER_MAP` matched no real
server, and Carbon Black read a field name the UI never collects. We are making
the **Integration Descriptor** the one place a code-backed integration's registry
facts are stated, with every other registry deriving from it. A ratchet test
originally gated the parts that could not derive from it, but that gate no
longer exists: #3435 deleted the unit test suites, so at 1.1.2 nothing
machine-gates this parity.

## Two identifiers, kept separate

An integration has an **Integration Id** (persisted: primary key of
`integration_configs`, key in `integrations_config.json`, stem of each secret's
storage name) and zero or more **MCP Server Names** (running processes, and the
prefix on the tool names they expose). Collapsing them to one string is the
obvious simplification and we rejected it: renaming an Integration Id orphans a
DB row, a config entry, and an encrypted credential simultaneously, so it is a
data migration rather than an edit. Both stay, both are declared on the
descriptor. No id is renamed — the drift is fixable without touching
anyone's stored config. A ratchet test originally asserted every server name
resolves to a real `mcp-config.json` key, but that test was deleted with the
unit suites in #3435, so the check is no longer run in CI.

The server field is a tuple rather than a single name because one vendor can
back several servers: Splunk has both an official `npx` server and the
self-hosted one Vigil ships. The same reasoning settles field-name mismatches —
where a server and the catalog disagree (Carbon Black's `api_token` against
the catalog's `api_id`/`api_key`, Palo Alto's `url`
against `hostname`), the catalog wins and the server adapts, because catalog
field names are already the storage names and renaming one orphans a credential.

## Credentials never come from the config file

`split_secrets()` strips every registered secret field before persisting to the
DB or JSON, so `get_integration_config()` cannot return a credential by design.
Any server reading one from there gets `None`. A descriptor-driven helper in
`core/integrations/_base/` is the way a code-backed vendor `tool.py` server
resolves config: non-secrets from `get_integration_config(id)`, secrets from
`get_secret(...)` using the descriptor's own field list. The default secret
name is `"<UPPER_ID>_<FIELD>"`, but per-integration overrides in
`integration_secrets.py` replace it where a consumer reads a different name
(for example CrowdStrike's `client_secret` → `FALCON_CLIENT_SECRET`, or
PagerDuty's `api_token` → `PAGERDUTY_API_KEY`), and non-secret fields also
fall back to `get_secret(env_var_for(...))` when the stored config is empty.
The same module also provides `resolve_fields()` for callers with no
descriptor, such as a generated custom integration. This replaces
`tools/base.py`, which was deleted as dead code in #585 — every server
had inlined its own copy instead.

A descriptor declares its **complete** field list, not just the secret ones, so
the helper returns a mapping keyed by declared fields and a server can only read
what its descriptor declares. That makes the catalog-parity check purely static
in principle — descriptor fields against catalog fields — with no parsing of
server source anywhere, though no test currently runs it (see above).
Descriptors are found by scanning `core/integrations/*/descriptor.py`,
mirroring the router scan in `services/api/discovery.py`, because the previous
import-list approach is exactly how the darktrace descriptor went dead in #557.
Darktrace itself currently has no descriptor — #557 removed the dead one, and
its slice is now webhook/ingestion only, not a descriptor-backed Integration.

## Consequences

- No vendor server lives in the top-level `tools/` package (only `__init__.py`
  and `mcp/` remain there). Every code-backed vendor owns
  `core/integrations/<vendor>/`; a vendor whose only presence is a
  third-party `mcp-config.json` entry still owns a descriptor-only slice, as
  `jira` already did. `tools/mcp/` is unaffected — those servers talk to Vigil's
  own services and are not Integrations.
- Catalog-only vendors — a credential form with no Vigil code — get no
  descriptor. Their parity with the frontend catalog was originally gated by
  `tests/unit/_ratchets/`, following the `config.py` ↔ `env.example`
  precedent, until #3435 deleted the unit suites; at 1.1.2 that parity is
  ungated.
- The bridge's dynamic-load path is deleted rather than repaired. Every server
  Vigil runs is declared in `mcp-config.json`, and the path only ever spawned
  modules that do not exist.

> Status note (2026-11-19): re-checked at Vigil 1.1.4 — descriptor parity is still ungated, and this decision is still in force.

{% endraw %}
