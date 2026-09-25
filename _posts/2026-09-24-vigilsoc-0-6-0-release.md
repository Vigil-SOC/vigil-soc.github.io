---
layout: post
title: "VigilSOC 0.6.0 is Live: Contract Stability, Fixed Helm Deployments, and the Ramp to 1.0"
date: 2026-09-24
author: "John Van Lowe"
category: "Engineering"
tags: [release, engineering, kubernetes, helm, mcp, community, roadmap]
excerpt: "VigilSOC 0.6.0 is available on GitHub — featuring frozen /api/v1 contracts and MCP tools, fresh container images resolving 0.5.0 Helm permissions, episodic memory, shadow adjudication, the kickoff of Community Office Hours, and our formal ramp to v1.0.0."
---

VigilSOC version 0.6.0 is officially live on GitHub! This milestone marks a major step forward for VigilSOC: locking down frozen API contracts and MCP tool surfaces, resolving container deployment permissions for Kubernetes and Helm, introducing closed-loop threat hunting and shadow adjudication, and kicking off our formal path toward v1.0.0.

Following our [0.5.0 release](https://vigilsoc.org/blog/2026/08/20/vigilsoc-0-5-0-release/), the community pushed hard to turn early architectural experiments into stable, production-grade contracts. Here is a breakdown of what has landed in 0.6.0, what it means for your deployments, and what is coming next.

## What's New in 0.6.0

0.6.0 brings substantial functional additions across our agent runtime, memory architecture, API contracts, and operator tooling:

- **Frozen API Contract Surface (`/api/v1`):** We have formalized our HTTP contract across findings, cases, approvals, workflows, runs, and metrics under `/api/v1`. The contract is frozen and enforced by committed schema snapshots and automated CI drift tests, guaranteeing interface predictability for downstream consumers.
- **17 Frozen Core MCP Tools:** The core tool suite exposed via the `vigil` MCP server (`/mcp`) is now frozen with dedicated drift testing. Custom agents and third-party orchestration harnesses can depend on stable parameter schemas and predictable return structures.
- **Closed-Loop Threat Hunting & Console Replay:** Threat hunts can now be initiated directly from the web console. Crucially, operators can now review full hunt replays (`GET /runs/:id/replay`), inspecting the precise context digest, hypothesis path, and tool outputs that informed each agent decision.
- **Continuous Evaluation & Shadow Adjudication:** To evaluate agent judgment in real-world scenarios without operational risk, 0.6.0 introduces shadow adjudication (`ORCHESTRATOR_SHADOW_ADJUDICATION`) running silently alongside admitted findings. In addition, daily known-answer probes automatically traverse triage and score decisions against verified ground truth.
- **Episodic Memory via Recall:** We have retired the experimental MemPalace layer in favor of domain-driven Recall and episodic memory. Investigations now systematically record what prior runs observed and concluded, distilling cited techniques directly onto queryable records keyed by MITRE ATT&CK technique IDs.
- **Native Atomic Red Team (ART) Integration:** Adversarial validation is now first-class. The MITRE Analyst agent can execute harness-gated ART tests, reconstruct execution traces into per-step detection verdicts, and display validated coverage directly on the ATT&CK dashboard.
- **Standardized `SKILL.md` Agent Skills:** Agent capabilities are now packaged into spec-conformant markdown skill directories. 0.6.0 ships with dedicated skills for phishing triage, periodic beaconing review, internal RDP movement analysis, executive summary board briefs, and threat intel IOC enrichment.
- **Tamper-Evident Ledger:** All agent actions and execution records are hash-chained on insertion into `agent_events`, with application database privileges restricted strictly to `INSERT` and `SELECT` to preserve non-repudiable audit logs.

Check out the complete changelog and code on our [GitHub Releases page](https://github.com/Vigil-SOC/vigil/releases/tag/v0.6.0).

## Helm Deployments: Fresh Container Images & Permission Fixes

A key operational focus in this release was addressing friction in containerized and Kubernetes environments.

In the 0.5.0 release cycle, users deploying the Vigil Helm chart into Kubernetes clusters with strict security contexts encountered permission failures. In environments where pods ran with unprivileged user IDs or where the container root environment defaulted to `HOME=/`, daemon and backend workers could crash with `Permission denied` when attempting to initialize the state directory at `/.vigil`. Additionally, stale container generation artifacts in earlier automated builds left some of those fixes unapplied.

Release 0.6.0 completely resolves this:

1. **Freshly Baked, Cosign-Signed Images:** All 0.6.0 container images (`vigil-backend`, `vigil-daemon`, and `vigil-web`) have been freshly generated and published with keyless Cosign cryptographic signatures (`ci(release)`).
2. **Hardened Non-Root Container Execution:** Dockerfiles have been updated with explicit non-root UID/GID (`1000`) configuration and dedicated home directories.
3. **Safe State Path Resolution:** The runtime configuration now uses a `_safe_home()` helper that detects restricted root file systems and automatically falls back to `/home/vigil` or `/tmp/.vigil`.
4. **Updated Helm Defaults:** The Vigil Helm chart templates now explicitly configure safe environment variables (`HOME=/home/vigil`), ensuring pods deploy cleanly without custom pod security context workarounds.

If you encountered deployment hurdles with 0.5.0 on Kubernetes, upgrading to the 0.6.0 chart and images will get your cluster operational immediately.

## Shoutout to Our Contributors

An open-source security platform is only as strong as its community. A massive thank you to everyone who contributed code, reported edge cases, reviewed designs, and benchmarked candidate images throughout the 0.6.0 cycle.

Special thanks to: **Sam Armstrong (`samarmstrong`)**, **Nestor (`nestor-deeptempo`)**, **Gray Egboluche (`G-r-ay`)**, **Craig (`craig-dt`)**, **Alex (`ShmalexM`)**, **Evan Powell**, **Matt Morris (`mattmorr1`)**, **Josh Cox**, **Amir Fathi**, **Jonathan**, **Mayank Kumar**, **Antoine Leclef (`antoine-leclef`)**, **dev_Hakaze**, **jmurph1**, **sud03rs**, and **thetosy**.

## Get Involved: Community Office Hours Are Starting!

To foster closer collaboration between maintainers, security engineers, and community contributors, we are officially kicking off **VigilSOC Community Office Hours**!

These sessions are designed as open, collaborative working hours. We'll be:
- Giving live sneak peeks of upcoming features and previewing autonomic operations.
- Walking through building custom MCP servers and extending `SKILL.md` detection workflows.
- Answering questions about Kubernetes/Helm architectures, model routing, and local LLM execution.
- Soliciting direct feedback from practitioners running Vigil in their labs and SOCs.

👉 **RSVP & Schedule:** Reserve your spot on our [Luma Community Calendar](https://luma.com/vigilcommunity).

👉 **Join the Discussion:** Drop into the [VigilSOC Discord server](https://discord.gg/SBtSHzMYFZ) to connect with the team in the **#office-hours** and **#announcements** channels!

## The Ramp to v1.0.0: Stability Guarantees & Autonomic Operations

With 0.6.0 live, the engineering roadmap is locked onto our **v1.0.0 release milestone**.

When we published our [Summer Update](https://vigilsoc.org/blog/2026/08/05/shipping-fast-breaking-less/), we noted that pre-1.0 development required moving fast and breaking contracts when upstream standards shifted. In 0.6.0, that posture transitions to predictability. As codified in our newly published [VERSIONING.md](https://github.com/Vigil-SOC/vigil/blob/main/VERSIONING.md), here is what the ramp to 1.0 guarantees:

- **Strict Additive-Only Evolution:** Once 1.0 lands, the `/api/v1` contract and frozen MCP tools will change *only additively*. Any breaking schema modification or deprecation removal is strictly deferred to major versions.
- **Dual-Mounting Legacy Compatibility:** For backwards compatibility, legacy unversioned endpoints remain dual-mounted alongside `/api/v1` and will be preserved through 2.0 to give enterprise teams ample time to migrate integrations.
- **Autonomic Operations with Human-on-the-Loop Governance:** The core technical theme leading into 1.0 is autonomic operations — empowering agents to handle closed-loop triage and enrichment while ensuring human supervisors maintain control. Features like approval reversibility, idempotency keys, budget kill-switches, and automated shadow evaluation provide the safety guardrails necessary for enterprise adoption.
- **Disciplined Release Cadence:** We continue to enforce our 10-issue Work-in-Progress (WIP) cap per release milestone, governed by strict P0–P3 urgency tiers and weekly triage loops.

Want to pick up a good first issue, contribute a detection rule, or track where upcoming features sit in the queue? Explore our [open issues on GitHub](https://github.com/Vigil-SOC/vigil/issues) or read our contributor guidelines in [CONTRIBUTING.md](https://github.com/Vigil-SOC/vigil/blob/main/CONTRIBUTING.md).
