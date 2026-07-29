---
layout: post
title: "What Does an Optimized Agent Harness Look Like in Security?"
date: 2026-07-28
author: "Sam Armstrong"
category: "Research"
tags: [agents, benchmarks, patching, security]
excerpt: "A task-shaped patching harness and one validation-feedback round improved a local PatchEval result by roughly 25 percentage points while keeping model costs low."
---

## TL;DR

- A task-shaped security harness can use a simpler, lower-cost path than a general-purpose coding harness.
- The **outer** — not **inner** — harness is most relevant to move the needle, but this is not allowed in many benchmark leaderboards.
- In my experiment, one feedback loop improved performance by ~25 percentage points (roughly 32% → 57%).

> **Disclaimer.** This work was done on the original PatchEval benchmark. On July 24, 2026 — after these runs — ByteDance released [PatchEval-Verified](https://github.com/bytedance/PatchEval), with revised Docker environments and a new leaderboard. The numbers below are from the prior version and are not comparable to PatchEval-Verified. We plan to re-run against the updated version and will follow up.

The best-known agent harnesses — Pi, Claude Code, Codex, OpenCode, etc. — are general-purpose coding environments. They are quite effective generally and being used across all disciplines; with a shell, Python, and file tools, an agent can address a broad range of problems. But it leaves a more specific question: if we start with a specific but highly relevant security use case, rather than general software development, what should the harness look like? Could it be cheaper and more effective?

Security has its own definitions of success. Security benchmarks exist, but many receive less attention than general coding evaluations. I found [PatchEval](https://github.com/bytedance/PatchEval) (developed by ByteDance) on GitHub; it has a practical evaluation setup for patching CVEs. I used it to explore this question from first principles.

## First: remove the general-purpose machinery

The original PatchEval evaluation covered 230 real, Dockerized CVEs across Go, JavaScript, and Python. A successful patch had to neutralize the proof-of-concept exploit and keep the project's unit tests green. I started by asking whether the usual general-purpose coding environment was necessary for that workflow (answer: no).

The resulting baseline is one task-shaped LLM call per CVE. The model reads the CVE description, selects files from the repository's Git-tracked file list, and produces exact search/replace edits. A few hundred lines of Python turn those edits into a `git diff`.

With `gpt-5-codex`, this minimal setup scored **~32-35%**, at **$0.18 per CVE**. That was roughly one tenth of the $1.13–$2.39 per-CVE cost reported for the original benchmark's agent runs.

## Then: add the feedback that vulnerability management uses

Those in security are well aware that producing a patch is only the first step in vulnerability management. You retest the vulnerability and determine whether the fix worked.

The broader principle is pretty straightforward: a loop is more useful when it has a verifier. A verifier gives the system a result it can act on. For security patching, that verifier can be an exploit reproduction, a scanner, a test suite, or another task-specific check.

Holding everything else fixed, one validation-feedback round produced **~57%** on the strict metric (60% counting exploit neutralization alone). That is a **~25 percentage point increase**, still at about a ~10x reduction in cost versus the original benchmark's reported agent runs.

## Confession: I wasn't supposed to do that

Shortly after, I noticed that the original PatchEval leaderboard rules excluded results incorporating a feedback loop around the task. Oops. But let's unpack that a little more.

That restriction is reasonable if the goal is to measure zero-feedback patch generation, and I understand it protects against brute forcing, but can you really measure a harness if you can't include a feedback loop? I suppose it could reveal that x harness has more bloat compared to y harness which increases token cost and *maybe* reduces performance in this task, but for the most part, it's evaluating the LLM.

## Precise terms and definitions are helpful

I watched [Gergely Orosz interview Dex Horthy](https://newsletter.pragmaticengineer.com/p/context-engineering-with-dex-horthy) on the Pragmatic Engineer podcast recently. Their discussion of context, harnesses, and loops was a useful reminder that the terms matter. I agree with Dex here that [Martin Fowler's description of harness engineering](https://martinfowler.com/articles/harness-engineering.html) provides a helpful vocabulary:

- The **inner harness** is what the tool builder ships: the agent loop, read / write / bash tools, and fixed instructions.
- The **outer harness** is the task-specific system built around it: inputs, scaffolding, verification, and feedback loops.

This distinction explains the evaluation boundary. The original leaderboard's public rows were labelled with harnesses — SWE-agent, OpenHands, ClaudeCode, and others — and its settings varied the inner harness. But validation-feedback results were ineligible, so there was little place for an outer harness.

## If you're building a patching agent

The benchmark constraint is useful for measuring zero-feedback patch generation, but real patching systems often do have a feedback signal: a reproduction, scanner, test suite, or deployment check. A practical security-patching agent would separate the two layers:

1. **Inner harness: minimal and task-shaped.** One precise call per patch attempt — CVE description, candidate files, exact-edit output format. Not a general-purpose coding agent spending tokens on irrelevant exploration.
2. **Outer harness: the verification loop.** Rebuild, re-run the exploit reproduction (or scanner, or tests) against the patched artifact — in our run this was the benchmark's binary output; in production it's whatever verifier you can stand up — and if it still fails, feed the failing output back for another attempt.

For this experiment, step 2 accounts for the large measured change of ~+25% in one round on real CVEs.

## Other thoughts about the state of 'Benchmarks'

Reproducing less-well-established benchmarks can be highly error-prone. I ran these benchmarks from my Mac, which was not fully supported out of the box (Docker Desktop issues, etc.). It's also time-consuming and expensive. I had to start by reproducing an existing benchmark result just to be assured that everything was working as intended. At the time of the experiment, the leaderboard had not been updated with the latest rounds of frontier models.

I also checked out [VulnBench](https://github.com/vulnbench/vulnbench), a patching benchmark that scores with LLM judges rather than execution. Its published board mixes judging protocols across rows (single-judge vs dual-judge consensus), and testing this myself I found that this difference does result in significantly different results.

I made upstream contributions to both of these benchmarks to try to improve the rough edges for those who want to engage in the future. But a clear takeaway from this experience — there's a lot of noise with benchmarks, especially smaller or less-maintained ones. Or more specifically:

1. Be skeptical of the results until you've verified it yourself.
2. Maintaining up-to-date benchmark results / leaderboard is challenging.
3. Question what the benchmark is really measuring. Is that a good proxy for what would exist in production?

## What next

We're open-sourcing [PatchLoop](https://socbench.org/patchloop/), a TypeScript library built with Effect that packages this verification-loop pattern. The [source](https://github.com/DeepTempo/socbench/tree/main/src/socbench/patchloop) lives in SocBench. The [interactive PatchLoop explainer](https://socbench.org/patchloop/) lets you step through the verification loop and a side-by-side cost comparison against a general coding agent.

[DeepTempo](https://www.deeptempo.ai) open-sourced [Vigil](https://github.com/Vigil-SOC/vigil), an AI SOC. Our goal is to take lessons from exercises like this and bake custom outer harnesses into repeatable security workflows, rather than leave the verifier loop as a one-off experiment.

We also open-sourced [SocBench](https://github.com/DeepTempo/socbench), our own contribution towards evaluating AI against relevant security-specific use cases that aren't captured by current benchmarks. Follow DeepTempo updates on our [Blog](https://www.deeptempo.ai/blog).

— [Sam Armstrong](https://github.com/samarmstrong) ([X](https://x.com/samarmstrongx)), DeepTempo
