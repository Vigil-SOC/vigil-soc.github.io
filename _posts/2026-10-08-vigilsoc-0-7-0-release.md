---
layout: post
title: "VigilSOC 0.7.0 is Live: Sigma Lint & Replay, SIEM Federation, and Another Step Toward 1.0"
date: 2026-10-08
author: "John Van Lowe"
category: "Engineering"
tags: [release, engineering, agents, detections, federation, automation, roadmap]
excerpt: "VigilSOC 0.7.0 is available on GitHub — bringing Sigma rule linting and replay, SIEM federation over Elastic/Wazuh and OpenSearch, per-install support bundles, and a string of correctness fixes to approvals, response, and audit logging, all in service of the ramp to v1.0.0."
---

VigilSOC version 0.7.0 is officially live on GitHub! This release is smaller in headline scope than 0.6.0, and that's intentional — it spends its effort closing the gaps between "an analyst reviewed this" and "the platform can prove an analyst reviewed this." Detection rules get linted and replayed before they ship. Federated SIEM fetches that silently fail now say so. Approvals that aren't bound to a real person are refused outright. None of these are exciting on their own, but together they're exactly the kind of plumbing the ramp to 1.0 depends on.

![Tech and agent themed VigilSOC 0.7.0 banner with a circuit grid background, neon green glow, and badges for Agents, Sigma Lint, Federation, and Secure](/assets/blog/2026-10-08-vigilsoc-0-7-0-release/hero-banner.jpg)

Following our [0.6.0 release](https://vigilsoc.org/blog/2026/09/24/vigilsoc-0-6-0-release/), the community turned frozen contracts into frozen *behavior*: making sure the agents and federations built on top of those contracts fail loudly instead of quietly. Here's what landed in 0.7.0, what it changes for your deployment, and where it fits on the road to v1.0.0.

## What's New in 0.7.0

Whether you're running your first VigilSOC instance or you're deep in custom agent development, there's something here for you:

- **Sigma Rule Linting & Replay:** The Detections surface can now lint a candidate Sigma rule and replay it against historical data before it's promoted — so you catch a malformed field match or an over-broad condition before it ever pages someone. This is the fastest way to answer "will this rule actually fire the way I think it will?"
- **SIEM Federation, Expanded:** VigilSOC can now ingest Wazuh indexer alerts through Elastic federation without requiring Kibana in the loop, and OpenSearch joins Elastic and Splunk as a first-class SIEM integration. Each integration can now set its own `ca_cert_path`, trusted only by that integration's own clients — useful if you're bridging SIEMs with different internal CAs.
- **Agent Controls:** Agents gained list-level fields and can now be turned on or off individually from the web console, instead of all-or-nothing. The Agents tab itself was redesigned into a single table under a new "Agents & workflows" heading, with a **New workflow** button and timeline date-range filtering.
- **Cost Visibility:** Every spend figure now records the rate and fetch time behind it, so when a cost number looks off, you can see exactly which pricing snapshot produced it instead of guessing.
- **Bifrost Gemini Provider:** Bifrost now seeds a Gemini provider straight from `GEMINI_API_KEY`, no extra wiring required if that's the model you're routing to.
- **Memory: Emulation Learning Episodes:** Compose traces — the records of simulated adversary emulation runs — are now lifted directly into Recall as learning episodes, so what the platform learned from an emulation exercise feeds the same episodic memory that informs live investigations.
- **Structured Logging:** Logs can now be emitted as JSON without requiring OpenTelemetry, with `msg_template` and `exc_type` fields included — handy if your log pipeline expects structured JSON and you don't want to stand up a full OTEL collector just to get it.
- **Support Bundles:** A new `vigil-support.sh` script collects configuration, health, and logs into a single per-install bundle — the first thing we're going to ask for the next time you open an issue.
- **Desktop App:** The desktop app now keeps its own log and snapshots container logs before it quits, so a crash on exit doesn't take the evidence with it.

Check out the complete changelog and code on our [GitHub Releases page](https://github.com/Vigil-SOC/vigil/releases/tag/v0.7.0).

## Correctness Fixes You Were Probably Affected By

None of the items below are flagged as a single severity-ranked "critical" list in the release notes, but several close real correctness and audit gaps — the kind that don't show up until an investigation or an audit depends on them:

1. **Approvals require a bound principal.** `approve_action` is now refused when no principal is bound to the request. An approval that can't be traced to a person is no longer treated as a valid approval.
2. **Federation failures are recorded as failures.** Failed SIEM and CrowdStrike fetches — and Splunk polls where every query fails — used to look like empty-but-successful runs. Now they're recorded as failures, which is what lets you actually alert on federation health instead of silently losing coverage.
3. **Response actions report their real state.** Host isolation that isn't actually wired up is now recorded as failed rather than assumed successful, and isolations without an IP are keyed on hostname instead of being dropped.
4. **Alert exclusions respect IP scoping.** IP-based exclusions no longer page analysts about findings that were already excluded.
5. **Config changes are audited as the signed-in user.** Settings changes now write the actual authenticated user into the audit trail, not a generic service identity.
6. **Migration logs don't leak connection strings.** The `migrate` path now logs only the database host and name — not the full connection URL.
7. **Helm enforces all 34 migrations.** The Helm chart now applies the full migration set and fails the deploy outright if one is missing from `sqlFiles`, instead of silently skipping it.
8. **Storage sessions are bounded.** Idle-in-transaction sessions are now bounded, and the statement timeout is configurable — both of which matter if you've ever had a long-running query quietly hold a lock.

If you're running 0.6.0 in production, the federation and approval fixes in particular are worth prioritizing — they change what you can trust your dashboards to tell you.

## A Few Operational Notes

Nothing in 0.7.0 is called out as a breaking change, but a few things are worth knowing before you upgrade: the Helm chart and compose environment variable handling changed to support the fixes above, a couple of unused settings (`DAEMON_BATCH_SIZE` and the OpenAI default-provider variables) were removed since nothing was reading them, and the old Vigil-specific rate table was deleted in favor of pricing sourced from the gateway. If your deployment pins any of those variables explicitly, check the [full changelog](https://github.com/Vigil-SOC/vigil/compare/v0.6.0...v0.7.0) before you upgrade.

## The Ramp to 1.0: Automating the Human Elements

Every release note above is really the same story told a different way: an investigation has a set of steps a human used to have to do by hand — approve an action, confirm a SIEM fetch actually returned data, validate that a detection rule behaves the way it reads, isolate a host and verify it took — and 0.7.0 moves another one of those steps from "trust the operator did it" to "the platform can show you it happened, correctly, every time."

That's the real shape of the ramp to v1.0.0. We're not just freezing contracts and shipping features; we're systematically finding the points in an investigation where a human is still the only check, and replacing "a person watched this" with "the system verified this and can prove it." Sigma lint-and-replay means a rule's behavior is validated before a human ever has to eyeball it. Federation failure tracking means an analyst doesn't have to manually notice a quiet SIEM outage. Emulation learning episodes mean lessons from a red-team exercise get folded into agent memory automatically, instead of living in someone's head or a wiki page.

There's still real work ahead before 1.0 — closed-loop triage and enrichment with human-on-the-loop governance, not human-in-every-loop, is the target — but 0.7.0 is a concrete step in that direction, not just a promise of one.

Want to help close the next gap? Pick up a [good first issue](https://github.com/Vigil-SOC/vigil/issues), contribute a detection rule, or write up what you found running 0.7.0 in your own environment. Our [CONTRIBUTING.md](https://github.com/Vigil-SOC/vigil/blob/main/CONTRIBUTING.md) covers both the code repo and this blog — one post per PR, your own work, and bring receipts.
