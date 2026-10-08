---
layout: post
title: "VigilSOC 0.7.0 is Live: Sigma Lint & Replay, SIEM Federation, and Another Step Toward 1.0"
date: 2026-10-08
author: "John Van Lowe"
category: "Engineering"
tags: [release, engineering, agents, detections, federation, automation, roadmap, community]
excerpt: "VigilSOC 0.7.0 is live on GitHub — introducing Sigma rule linting and replay, expanded SIEM federation over Elastic/Wazuh and OpenSearch, critical audit and response correctness fixes, and a big shoutout to our human contributors."
---

VigilSOC 0.7.0 is officially live on GitHub! While 0.6.0 established frozen API contracts, 0.7.0 focuses on runtime correctness and verifiable platform behavior: detection rules are validated against history before promotion, silent SIEM ingestion failures are recorded honestly, and response actions require authenticated human principals.

![Tech and agent themed VigilSOC 0.7.0 banner with a circuit grid background, neon green glow, and badges for Agents, Sigma Lint, Federation, and Secure](/assets/blog/2026-10-08-vigilsoc-0-7-0-release/hero-banner.jpg)

Here is a concise breakdown of what shipped in 0.7.0, the key operational fixes, and a spotlight on the human community contributors who made it happen.

## What's New in 0.7.0

- **Sigma Rule Linting & Replay:** Lint candidate Sigma rules and replay them against historical telemetry directly in the Detections UI before promotion, catching malformed logic or broad matches early.
- **Expanded SIEM Federation:** Ingest Wazuh indexer alerts through Elastic federation without Kibana, query OpenSearch natively alongside Splunk and Elastic, and configure isolated per-integration `ca_cert_path` trust stores.
- **Granular Agent Controls:** Toggle individual agents on or off from the redesigned "Agents & workflows" table, complete with timeline date-range filtering and run replays.
- **Cost Transparency & Model Routing:** Spend metrics now track exact pricing snapshot timestamps, and Bifrost seeds Gemini providers directly from `GEMINI_API_KEY`.
- **Emulation Learning in Recall:** Adversary emulation traces automatically feed Recall episodic memory, ensuring lessons from red-team exercises enrich live investigations.
- **Observability & Diagnostics:** Export structured JSON logs without an OpenTelemetry collector, snapshot container state on desktop app exits, and generate diagnostic bundles via `vigil-support.sh`.

Full release details and artifacts are on our [GitHub Releases page](https://github.com/Vigil-SOC/vigil/releases/tag/v0.7.0).

## Correctness & Operational Fixes

0.7.0 resolves several subtle audit, security, and runtime gaps:

- **Principal-Bound Approvals:** `approve_action` now rejects unauthenticated or orphaned requests, ensuring every automated or manual approval traces back to a verified human principal.
- **Honest Federation Telemetry:** Failed queries across SIEMs, CrowdStrike, and Splunk are now explicitly recorded as failures instead of silent, empty successes.
- **Truthful Response Actions:** Host isolation without active bindings or IP addresses now logs real failure states or keys by hostname rather than dropping silently.
- **IP-Scoped Exclusions:** Alert suppression rules now respect IP boundaries without leaking false alerts.
- **User-Attributed Audit Trails:** Configuration changes record the authenticated operator rather than a generic service account.
- **Safe Migrations & Helm Enforcement:** Database migration logs redact connection strings, and Helm strictly enforces all 34 database migrations at deploy time.
- **Bounded Storage Transactions:** Idle database sessions and statement timeouts are bounded to prevent long-running lock contention.

## Community Spotlight: Human Contributors

This release was driven by our open-source community. A huge thank-you to the human contributors behind the code, documentation, and operational fixes in 0.7.0:

@samarmstrong, @G-r-ay, @CryptoJones, @ShmalexM, @joshuacox, @krmayankb, @nestor-deeptempo, @AmirF194, @mvanhorn, @epowell101, and @johnvanlowe.


## The Road to 1.0

The core theme on the ramp to v1.0.0 is shifting from **human-in-every-loop** to **human-on-the-loop governance**. By enforcing principal-bound approvals, validating detection rules against history, and tracking federation health honestly, 0.7.0 replaces manual verification with platform guarantees.

Want to get involved? Grab a [good first issue](https://github.com/Vigil-SOC/vigil/issues), test 0.7.0 in your environment, or consult our [CONTRIBUTING.md](https://github.com/Vigil-SOC/vigil/blob/main/CONTRIBUTING.md) to contribute detection rules and integrations.
