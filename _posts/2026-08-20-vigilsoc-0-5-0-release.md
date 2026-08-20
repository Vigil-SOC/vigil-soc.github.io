---
layout: post
title: "VigilSOC 0.5.0 is Live: Key Upgrades, Contributor Shoutouts, and Community Office Hours"
date: 2026-08-20
author: "John Van Lowe"
category: "Engineering"
tags: [release, community, detection, engineering, roadmap]
excerpt: "VigilSOC 0.5.0 is available on GitHub — with faster event processing, an expanded rule engine, cleaner CLI and APIs, and a stack of stability fixes. Plus contributor shoutouts, new Community Office Hours, and a look at how we run the development process."
---

VigilSOC version 0.5.0 is available on GitHub! This release brings key updates designed to streamline threat detection workflows, boost engine performance, and polish the overall contributor experience.

## What's New in 0.5.0

- **Performance Enhancements:** Optimized event processing pipelines to significantly reduce latency and memory consumption under high load.
- **Expanded Rule Engine:** Added out-of-the-box support for new detection telemetry sources and improved rule-parsing flexibility.
- **CLI & API Refinements:** Streamlined command-line options and updated backend APIs to make external integrations smoother.
- **Bug Fixes & Stability:** Squashed parsing edge cases, cleaned up verbose logging output, and resolved key pipeline stability issues.

Check out the full release notes and code on our [GitHub Releases page](https://github.com/Vigil-SOC/vigil/releases).

## Shoutout to Our Contributors

Open-source security tools only succeed because of the community behind them. A massive thank you to everyone who submitted PRs, reported issues, and tested candidate builds for this cycle. We extend a special thanks to the contributors: craig-dt, cyforkk, G-r-ay, jmurph1, josiahlashley21, mattmorr1, mgalore, nestor-deeptempo, pollychen-lab, samarmstrong, thetosy, and tomatotomata.

## Get Involved: Join Us for Community Office Hours

Whether you are implementing VigilSOC in production, building custom detection logic, or looking to submit your first open-source pull request, we want to connect with you.

We are kicking off regular **VigilSOC Community Office Hours** hosted directly on our Discord server. It's a casual space to ask the maintainers questions, give feedback on 0.5.0, or discuss upcoming feature roadmaps. Times will be determined and posted in the primary channels.

👉 Join the VigilSOC Discord server to get involved, check the schedule in the **#announcements** channel, and jump into the conversations!

## Upcoming 0.5.x and 0.6.0: Core Community & Development Expectations

For those who are interested in the details of the development process, we've summarized some of the prior conversations and repository references into the list below:

- **Pull-Based Queue & WIP Caps:** Engineering pulls work from a single stack-ranked queue, enforcing a strict work-in-progress cap of 10 open issues per release milestone. A new candidate issue is only pulled into a release when an item ships or is bumped.
- **Strict Label Discipline:** Issues are governed by a disciplined 15-label taxonomy broken into four distinct families: Type (bug, feature-request, docs, chore, question, security), State (needs-triage, backlog, blocked), Urgency (P0–P3), and optional Community tags (good first issue, help wanted).
- **Transparent Priority Tiers:** Urgency is explicitly ranked from P0 ("drop everything" issues) and P1 (scheduled for the current release) to P2 (slated for the next release or two) and P3 ("someday" items where community PRs are warmly welcomed).
- **Predictable Release Cadence:** Minor releases (such as 0.5.0) serve as our primary feature release units. Patch releases (such as 0.5.1) ship bug fixes anytime without milestone ceremony, while major version releases are saved for stabilized schema, API, and auth contracts.
- **The Weekly Cadence:** Backlog rankings are kept fresh through a 4-step weekly loop: triaging incoming reports within two minutes, re-ranking backlog items oldest-first within priority levels, pulling top items into the active milestone, and reviewing throughput.
- **Definition of Done:** An issue is considered done when its PR merges to `main`, and a release milestone officially closes when the final version tag is cut and published.

Want to pick up a good first issue or track where your feature request sits in the queue? You can explore our [open issues on GitHub](https://github.com/Vigil-SOC/vigil/issues) or read the complete process details directly in our repository's [CONTRIBUTING.md](https://github.com/Vigil-SOC/vigil/blob/main/CONTRIBUTING.md).
