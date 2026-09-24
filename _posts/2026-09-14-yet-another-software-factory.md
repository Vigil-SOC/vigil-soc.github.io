---
layout: post
title: "Yet another software factory (and why we built ours the way we did)"
date: 2026-09-14
author: "Sam Armstrong"
category: "Engineering"
tags: [agents, software-factory, engineering, open-source, process]
excerpt: "Everyone is building a software factory right now. Here is the one we built to develop Vigil, the opinions baked into it, and what has surprised us so far."
---

Software factories are a hot topic right now, and I am about to add to the noise: we built one. It grooms our backlog, opens PRs against Vigil, reviews and verifies them, and repairs its own build environment when it gets stuck.

I do not think the interesting part is *that* we built one. Lots of people are pointing agents at backlogs. The interesting part is where we ended up being opinionated, and why. So this post is mostly about that.

## Why a factory at all

For open source software the appeal is obvious. If you open the gates to the public, you have in theory an infinite source of contribution. Look at what Peter Steinberger has been doing with OpenClaw: dozens of PRs merged a day, sometimes more. You cannot review that volume by hand, so you need a scalable way to review code.

But review alone is not enough. A clean-looking diff does not guarantee the thing actually works as intended. So you also need *verification*, meaning someone or something actually runs the change and exercises it. We knew early that we would need both.

Then there is the less glamorous reason. We are a startup with a relatively small team, and we are not only reviewing PRs. We have to actually build Vigil. Community contributions are great, but this early we need to push the project in the direction we want it to go, with the people we have, under open source economics. A factory made a lot of sense for that too.

So that is where we actually started. Not with reviewing a flood of outside contributions (we do not have a million contributors yet), but with using the factory to develop Vigil in a chosen direction. That is arguably the harder problem, because it sits further up the chain: product direction, then implementation, and only then review and verification.

## Opinion 1: be GitHub native, and put the state in the issues

The factory's entire operating model is leaving comments in GitHub for the next agent to pick up. A groom verdict is a label plus a signed comment. A claim on an issue is a label. A PR's verification story is a section in the PR description. If a human replies on an issue, the issue gets re-reviewed.

The payoff is that giving an agent context is trivial. We point it at the issue URL. There is no hidden table of state that everything secretly depends on, nothing to migrate, back up, or watch drift out of sync with reality. GitHub is the source of record and the agent reads what is actually there, including whatever a human added five minutes ago.

We even resist pasting issue text into prompts. Agents get links, not excerpts. An excerpt is a second, staler copy of the issue that someone had to decide how to cut.

## Opinion 2: groom the backlog before you implement it

We did not start with implementation. We started with backlog grooming, because we had a lot of issues, and if you take every issue at face value and implement it, you will probably not like the result.

The biggest pitfall with a software factory is maintainability. It works great for the first month or two, then you hit a wall where the codebase has become so messy that velocity plateaus. Dex Horthy has written a lot about this. We wanted to get ahead of it by writing down, up front, how we want the software to be.

But it is too much to ask a single agent to implement a feature *and* uphold a whole philosophy of maintainability in one shot. This is the same reason human teams split the work: product or TPMs groom the backlog, and engineers focus on implementation. Narrowing the focus works just as well for agents as it does for people.

So we have a `principles.md` that powers the grooming agent. It is about what to build, not how to write code. A flavor of it:

> An indirection with one caller is not an abstraction, it is a detour. Inline it. Two real call sites that exist today can justify one; an anticipated second caller cannot.

> Deleting code, collapsing two mechanisms into one, or removing a layer is worth more than an equivalent amount of new code.

Grooming produces a verdict (groomed or needs-work), a comment explaining why, and any coding-level notes the implementer should know. Nothing unvetted ever gets implemented. If the implementer later fails to produce a PR, that is treated as evidence the groom was wrong, and the verdict is retracted.

## Opinion 3: independent review, and verification that admits what it did not do

For implementation we wanted two things: an independent review, and real verification.

Verification matters a lot more with cloud agents than with a terminal session, because you are not watching. When you shepherd an agent by hand you notice when it quietly skips running the tests because Postgres was not up. In the cloud, you do not. So we make the agent tell us. Every factory PR ends with a Verification section in three parts: what it **ran**, what it **did not run** and why, and what it was **blocked by the machine** on, meaning a tool that was not installed, a service that was not up, a dependency it had to install by hand before anything worked.

That last category is the important one, because it feeds a healing loop. A separate agent, which we call the environment agent, runs after the implementers each day. It reads the factory's own PRs looking for checks the author could not run, and fixes the cloud agent environment so the next implementer can. The factory owns the machine it builds on. If an agent could not verify its change because the sandbox was missing something, that is the factory's bug, not the reviewer's problem.

## Opinion 4: something has to push the other way

Grooming was not the only thing we did to stay ahead of a messy codebase. We also run a simplify pass, in parallel with implementation, and honestly this has been one of the best things so far.

As you develop with agents you end up with complexity in places. Every individual PR is locally reasonable and the sum gets unwieldy. Another pass that focuses only on simplification cleans a lot of that up. But I have found it works best as an *independent* thing, outside of any implementation task, just looking over the codebase.

The one rule the factory enforces mechanically: the simplification PR must remove more lines than it adds, or the factory closes it before a human ever sees it. No helper to replace three plain lines, no test asserting a deleted thing is gone. Deleting is the point.

## Opinion 5: a human merge is the throttle

To keep the factory from getting out of control early, there is exactly one knob: how many jobs can exist at once. That counts open factory PRs still waiting on a human plus pipelines currently running. If we already have that many open, the daily run just acknowledges they are there and does not open more. Grooming still happens, because grooming produces no code.

This means we never flood ourselves. Autonomy gets widened by raising one number, not by adding machinery. And a human merging or closing a PR is literally what frees the next slot.

## Opinion 6: do not over-prescribe

This is a general rule across the whole factory. We hand the agent the GitHub issue, tell it how we like to work in a short prompt, and ask it to implement and verify. We do not force it through a rigid workflow with pages of instructions, forced output schemas, or controller-orchestrated review gates. Prompt lines exist only where we are specifically opinionated.

The same thinking applies to the repo itself. The question of `AGENTS.md` came up: why not put tons of information in there? We actually do not have one yet, and we have been debating what should go in it. My hesitation is specific to outside contributors. I view PRs from outside contributors as liquid gold, because they bring a fresh perspective on how the software should be improved or where it should go. It is not always a little bug fix. I do not want an `AGENTS.md` that forces *their* coding agents to contribute in the specific way we already do on our own. Keeping the context lean for our agents has been a positive, and not baking our current thinking into a rule set that affects everyone's session on the repo feels like the right call for now.

## Runtime: we just used Cursor

There is a lot of discussion about factory runtimes: durable objects, sandboxes, and so on. We decided to use Cursor cloud agents for our use case. A little vendor lock-in, sure. But all of that runtime question is already accounted for, and Cursor lets us pick from a variety of models so we can optimize for cost per phase. Grooming, selecting, implementing, and simplifying do not all need the same model.

The other nice thing is observability out of the box. If we want to look at a session, we open it in Cursor exactly as we would for a local agent. It just happens to have run in the cloud, from trigger to completion. Between model selection, not reinventing cloud runtimes, and viewing sessions natively, it was a natural fit right away.

## How it has gone

Really well so far. We had several dozen open issues and burned that backlog down to zero in about a week. From there it was: awesome, now let's start on the next pieces. We are now powering our way toward Vigil 1.0 and using the factory to get there with reasonable velocity.

If you are building one of these yourself, or contributing to Vigil and curious how your issue gets picked up, the factory's behavior is entirely visible in the issues and PRs on GitHub. Feel free to debate (or argue), with our factory agents, and direct feedback to the Vigil team is always welcome. 
