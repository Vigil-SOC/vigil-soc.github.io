---
layout: post
title: "VigilSOC 0.8.0 is Live: A Reimagined UI/UX, Streamlined Workflows, and the Sprint to 1.0"
date: 2026-10-21
author: "John Van Lowe"
category: "Engineering"
tags: [release, engineering, ui, ux, agents, workflows, mcp, roadmap, community]
excerpt: "VigilSOC 0.8.0 is live on GitHub with a top-to-bottom redesign of the web interface, clearer multi-agent workflow state, and performance fixes for dense alert streams. Here's what shipped, what's next in 0.9.0, and how to send feedback."
---

VigilSOC 0.8.0 is officially live on GitHub. This is one of our most significant visual and operational updates so far. The goal for this release was to reduce analyst cognitive load, rework the UI/UX for fast-paced incident investigation, and make multi-agent workflow execution easier to follow.

![VigilSOC 0.8.0 release banner](/assets/blog/2026-10-21-vigilsoc-0-8-0-release/vigil080-release-banner.png)

Whether you run Vigil as an interactive dashboard or a 24/7 headless daemon, 0.8.0 makes navigating findings, reviewing agent approvals, and managing investigations faster and more intuitive.

## What's New in 0.8.0

The centerpiece of this release is [PR #2048](https://github.com/Vigil-SOC/vigil/pull/2048), a top-to-bottom redesign of Vigil's web interface and its core UX primitives.

### Modernized UI and Visual Hierarchy

- **Redesigned Investigation Dashboard:** New layouts for findings, cases, and active agent execution timelines.
- **Clarity First:** Clearer visual distinction between low-confidence automated actions and high-confidence auto-approvals.
- **Responsive Command Palette:** Fast navigation across findings, integrations, and detection coverage rules.

### Refined Multi-Agent Workflows

- **Simplified Natural Language Steering:** Updated chat and case-management panels let analysts inject commands such as "add to case", "run threat hunt", or "contain endpoint" without losing context.
- **Unified Execution State:** Real-time visibility into tool usage across active Model Context Protocol (MCP) servers during multi-agent orchestration.

### Quality of Life and Performance

- Smoother transitions across high-density alert streams.
- Smaller frontend bundles and optimized render loops for dense case timelines.

Full release details and artifacts are on our [GitHub Releases page](https://github.com/Vigil-SOC/vigil/releases/tag/v0.8.0).

## Community Spotlight

An open-source AI SOC is only as strong as the community behind it. Thank you to everyone who opened pull requests, filed bug reports, tested release candidates, and shared prompt improvements for 0.8.0, including the code, detection rule mappings, and UI bug fixes that landed in PR #2048 and the surrounding work.

Your pull requests, Discord feedback, and real-world testing are what keep this project moving.

## The Road Ahead: 0.9.0 and Then 1.0

With 0.8.0 out, work begins on 0.9.0, the final planned release before 1.0.0. It is the release-candidate polish phase, and its priorities are:

- Full API and MCP tool schema stabilization.
- Performance benchmarking and high-throughput messaging improvements.
- Finalizing default Agentic Skill definitions (`SKILL.md`) across all core playbooks.

## We Need Your Feedback

0.8.0 changes how analysts interact with Vigil, so feedback now is especially valuable. We'd like to know:

- **UI/UX:** How does the new dashboard feel during live investigations? Is the information density right?
- **Workflows:** Are the multi-agent execution states and tool notifications easy to follow?
- **Edge cases:** Did you hit UI glitches or unexpected behavior on custom screen resolutions?

To try it:

```bash
git fetch origin
git checkout v0.8.0
./start.sh
```

Then share what you find:

- **Discord:** Post in `#ui-ux-feedback` on the [community page](https://vigilsoc.org/community/).
- **GitHub:** [Open an issue or feature request](https://github.com/Vigil-SOC/vigil/issues).

Want to contribute more directly? See [CONTRIBUTING.md](https://github.com/Vigil-SOC/vigil/blob/main/CONTRIBUTING.md). Thank you for being part of the Vigil community on the way to 1.0.
