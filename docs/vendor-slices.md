---
layout: docs
title: "Vendor Slices"
permalink: /docs/vendor-slices/
---

{% raw %}
One directory per vendor. A slice holds whatever that vendor needs — most
are just a `descriptor.py` declaring its config fields and a `tool.py` if the
vendor is exposed to agents as an MCP server. Some slices add a `client.py`
for in-process calls, and a couple add a webhook router.

`tool.py` is a standalone MCP server over stdio. On the MCP-spawn path,
`mcp-config.json` spawns it as its own `python3` subprocess, so it is not
imported by the API, the daemon or the worker. There is one exception:
`cloudflare/tool.py` is also imported in-process by the daemon, via
`AutonomousResponseService` in `core/response/autonomous_response_service.py`,
for approved response actions.

The slices whose `tool.py` makes direct `httpx` calls are:
`alienvault_otx`, `anyrun`, `azure_ad`, `cape_sandbox`, `carbon_black`,
`cloudflare`, `hybrid_analysis`, `ip_geolocation`, `microsoft_defender`,
`microsoft_teams`, `misp`, `palo_alto`, `slack`. The remaining slices —
`amazon_security_lake`, `atomic_red_team`, `elastic`, `opencti`, `opensearch`,
`splunk`, `url_analysis`, `vstrike`, `wazuh` — make no `httpx` call inside
`tool.py` itself; where they use HTTP, it lives in the slice's `client.py` or
service module (for `amazon_security_lake`, in `lake.py`, which calls AWS via
`boto3`). Only `url_analysis` (local parsing) and `atomic_red_team` (a
`subprocess` runner) are genuinely network-free. `mcp-config.json` is the
authority on which servers are actually spawned.

## Reading config

`resolve(DESCRIPTOR)` from `core.integrations._base.config` is the one way a
server reads its own config; `missing(config, 'url', 'api_key')` is the
"not configured" guard. Don't reach for `get_integration_config` directly — it
never sees secret fields, because `split_secrets` strips them before anything is
persisted.

`resolve()` returns **every** declared field, present-but-`None` when unset, so
`config.get('verify_ssl', True)` never fires its default. Write it out:

```python
verify = True if config.get('verify_ssl') is None else config.get('verify_ssl')
```

## Conventions for outbound HTTP

`httpx` is the HTTP client for tool servers. One legacy `requests.auth` use
remains in application code, in `core/threat_intel/threat_feed_service.py`.

| | |
|---|---|
| `timeout=` | Required. httpx defaults to 5s, too short for a sandbox report or a SIEM search, so state a budget per call. |
| No `follow_redirects` | For direct `httpx` calls in `tool.py`: httpx's default, and the one to keep — not something a server has to handle. Most servers hardcode their vendor's host, so a 3xx is unreachable anyway. It matters for the ones whose host is operator-supplied (`cape_sandbox`, `carbon_black`, `microsoft_teams`, `misp`, `palo_alto`): there a 3xx means a wrong base URL, and following it would be worse than surfacing it — on a POST, a 301/302/303 is re-issued as a GET without the body, so a "delivered" alert silently isn't. A handler that reads `status_code` instead of calling `raise_for_status()` must carry the status into its payload, or the failure is undiagnosable. This convention does not cover the whole outbound-HTTP surface: slices whose HTTP lives in a client module also take operator-supplied hosts (`elastic`, `opencti`, `opensearch`, `splunk`, `vstrike`, `wazuh`), and some of those clients explicitly follow redirects — `splunk/client.py` and `vstrike/client.py` both set `_FOLLOW_REDIRECTS = True`. |
| `verify=<resolved verify_ssl>` | For on-prem appliances that may use self-signed certs. Never hardcode `verify=False` — the operator opts out. |
| `except httpx.HTTPStatusError` | The twin of `requests.HTTPError`. `httpx.HTTPError` is its parent and also catches transport failures, which belong to the generic handler. |
| No `None` in `params=` | requests dropped a `None`-valued param; httpx sends `key=`. A tool call may carry `"limit": null`, so write `args.get("limit") or 20`, not `args.get("limit", 20)`. |

### CA bundles

To trust a private or inspecting CA, set **`SSL_CERT_FILE`** (a bundle file) or
**`SSL_CERT_DIR`** (a directory) in the backend's environment. `REQUESTS_CA_BUNDLE`
and `CURL_CA_BUNDLE` are honored as aliases for the `requests` era, translated to
the name httpx actually reads. Unset, httpx uses certifi.

`core/integrations/mcp/child_env.py` resolves this and every spawn site merges
it into the child environment. Forwarding has to be explicit: `mcp.client.stdio`
narrows a spawned server's environment to `HOME`, `LOGNAME`, `PATH`, `SHELL`,
`TERM`, `USER` plus its own `env` block, so a bundle set in the backend's
environment is otherwise stripped before the server sees it.

A path that doesn't exist is ignored with a warning rather than forwarded — a
stale value should not turn into a bundle that fails every TLS handshake.

## Tests

The unit tests that once scanned every `tool.py` for the timeout and failed
CI on a hardcoded `verify=False` no longer exist in the code repo, so the
timeout and TLS conventions above are conventions, not CI-enforced checks.

## Adding one

1. Add the slice directory with a `descriptor.py`, then `tool.py` following the
   table above.
2. Add its entry to `mcp-config.json`.
3. Document it in `docs/integrations.md` on this documentation site and in the
   list above.
{% endraw %}
