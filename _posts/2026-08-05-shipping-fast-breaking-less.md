---
layout: post
title: "Shipping Fast, Breaking Less: A Vigil SOC Summer Update"
date: 2026-08-05
author: "John Van Lowe"
category: "Engineering"
tags: [engineering, mcp, release, kubernetes, community]
excerpt: "The repo is moving at its highest pace ever, the core is refactored and spec-aligned, and MCP's new 2026-07-28 release turned our biggest pre-1.0 risk into a 12-month safety net along with a stateless core that drops straight into Kubernetes."
---

If you've been watching the Vigil repo lately, you already know the vibe: the commit graph looks less like a heartbeat and more like a caffeine spike. We've spent the last stretch moving fast on the parts that matter. To summarize activity we are cleaning up the guts of the project, getting ahead of the biggest MCP change since the protocol launched, and taking the pain out of running Vigil in the places people actually run it.

## The scoreboard

Let's start with the numbers, because they tell the story faster than we can.

![Bar chart of Vigil repo velocity since July 1, 2026: 53 PRs merged, 89 PRs opened, 133 issues closed, 113 issues opened, with 114 PRs merged in the last 90 days out of 206 all-time.](/assets/blog/2026-08-05-shipping-fast-breaking-less/velocity.svg)

Since July 1, the repo has been *busy*:

- **53 pull requests merged** in a little over five weeks
- **89 pull requests opened** in the same window
- **113 issues opened** and **133 issues closed** — yes, we closed more than came in
- **114 PRs merged in the last 90 days**, which is more than half of every PR we've *ever* merged (206 all-time)

Stepping back to the all-time view: 206 PRs merged, 216 issues closed, with 18 PRs and 96 issues currently open and in flight. The bulk of the merge history happened recently, and issue burndown is running slightly ahead of intake even while more people are filing more things. That's the healthy kind of busy.

Every one of those numbers is a person: someone who filed a bug, reviewed a diff, argued about a design in a thread, or dropped a meme in Discord that somehow turned into a feature request. Vigil's third pillar has always been **YOU**, and the graph is starting to look like it.

## What we've been building: a cleaner core

Velocity is fun, but velocity toward *what*? The honest answer for this cycle is: toward a codebase that doesn't make new contributors wince.

![Layered diagram of the refactored Vigil architecture: agents and workflows over refactored frontend and backend tooling, an MCP client layer aligned to the 2026-07-28 spec, and MCP-server integrations such as SIEM, EDR, and threat intel.](/assets/blog/2026-08-05-shipping-fast-breaking-less/refactor-architecture.svg)

We've had our heads down on a focused refactor of the underlying tooling on **both** the backend and the frontend. The goal wasn't new features for their own sake but instead to pay down the kind of debt that accumulates when a project grows fast: inconsistent patterns, tooling that fought you more than it helped, and integration seams that had drifted out of alignment with the MCP standard they were supposed to speak.

Two forces drove the cleanup:

1. **Aligning with the MCP specification.** Vigil's whole pitch is that your integrations use an open standard, not a vendor's black box. That promise only holds if we actually track the spec closely. A lot of this work was getting our client and server code lined up with where MCP is headed, not where it used to be.
2. **Contributor feedback.** A steady stream of "why is this like this?" and "this would be so much easier if…" from the community. The refactor bakes a lot of that feedback directly into the structure of the code, so the next person to open the repo inherits the good decisions instead of the archaeology.

The result is a leaner core that's easier to read, easier to fork, and easier to rewire.

## A quick recap from Boston

I gave a presentation to a diverse mix of practitioners at the **AI Cyber Alliance** gathering in Boston hosted by **Venture Guides**. From the Vigil SOC perspective it was a focus on markdown skills/playbooks, MCP first/native integrations, and how to use local inference when appropriate. The discussions covered the Semantic Inference Routing Protocol, MCP Gateways and observability, and full end to end proof of agentic activity.

The discussion kept circling back to a tension that anyone building on a young protocol feels in their bones: how do you adopt something moving this fast without getting whiplash every time the standard shifts? I said the same thing in Boston that we've said in the README and in release notes all along: **while we're pre-1.0, breaking changes are on the table**, particularly where they follow changes to the MCP spec. Building on the frontier means occasionally rebuilding a piece of it. 

## The plot twist: MCP 2026-07-28

On July 28, the MCP maintainers shipped the **2026-07-28 specification** which is the largest revision of the protocol since it launched. Under normal circumstances, "largest revision since launch" is exactly the phrase that makes a pre-1.0 project break out in a cold sweat. This time it did the opposite. A couple of changes in the new spec turned our biggest sources of anxiety into non-issues.

### A real deprecation policy

The headline for us is boring in the best possible way: the spec now includes a **formal feature lifecycle with a 12-month deprecation window**. Anything marked for deprecation keeps working for at least a year before it can be removed, tracked with clear timelines rather than surprise removals.

![Timeline of MCP's 12-month deprecation window: on July 28, 2026 the 2026-07-28 spec deprecates Roots, Sampling, Logging, and the legacy HTTP+SSE transport while they keep working; the earliest possible removal is July 28, 2027.](/assets/blog/2026-08-05-shipping-fast-breaking-less/mcp-deprecation-timeline.svg)

"We might break things pre-1.0" is still technically true, but the ground under our feet just got a whole lot more stable. Breaking changes, when they come, will come with a calendar attached. That single change reframes our entire relationship with the spec. We can adopt aggressively without gambling that a future revision forces an emergency rewrite.

### Auth and state changes that solve problems we'd been working around

The 2026-07-28 spec fixed real pain points we'd been engineering around for months.

![Diagram of MCP authorization hardening: an MCP client authorizes against an OpenID Connect authorization server and receives an issuer-bound token for the Vigil MCP server, with callouts for RFC 9207 issuer validation, CIMD replacing Dynamic Client Registration, issuer-bound credentials, and clearer refresh-token and step-up scope rules.](/assets/blog/2026-08-05-shipping-fast-breaking-less/auth-hardening.svg)

The spec moved MCP to a **stateless core**. The old `initialize` handshake and the `Mcp-Session-Id` header are gone; every request now carries its own protocol version, client identity, and capabilities. On the auth side, the spec hardened everything to line up with mainstream OAuth 2.1 and OpenID Connect.

For Vigil, a bunch of the custom scaffolding we'd built to paper over session state and awkward auth flows can simply retire. Fewer workarounds, fewer moving parts, less code we have to maintain to keep the integrations honest. The refactor above and the new spec met in the middle at exactly the right moment.

## One more thing, for the Kubernetes crowd

Here's the callout we're most excited to make to anyone running Vigil in production.

![Diagram of a stateless MCP core in Kubernetes: clients send self-contained requests through a plain round-robin load balancer to any of four identical stateless Vigil pods, with no sticky sessions, no ingress persistence, and the freedom to scale, drain, and roll pods.](/assets/blog/2026-08-05-shipping-fast-breaking-less/stateless-kubernetes.svg)

Because the protocol is now stateless there is no session ID to pin a client to a particular server instance. **Any instance can serve any request**. That means Vigil sits happily behind a plain round-robin load balancer.

If you've ever deployed a stateful service into Kubernetes, you know the tax that stateless design just eliminated:

- **No sticky sessions.** You don't need session affinity to keep a client glued to the pod that holds its state, because there is no per-session state to hold.
- **No persistence games on the ingress.** No cookie-based affinity, no consistent-hash routing gymnastics, no special ingress annotations just to keep connections from falling over on the next request.
- **Scale and roll however you want.** Add pods, drain pods, do a rolling deploy and requests just land wherever the load balancer sends them and just work.

Getting Vigil into a cluster used to mean thinking carefully about session affinity and ingress configuration. Now it's closer to "point a standard load balancer at it and go." For teams trying to stand up an AI SOC quickly without becoming reluctant experts in ingress persistence, that's a genuine unlock.

## Where this leaves us

Put it all together and the summer nets out to something rare: we moved fast *and* reduced risk at the same time.

- The repo is shipping at its highest sustained pace ever.
- The backend and frontend are cleaner, more spec-aligned, and shaped by the people actually using them.
- The MCP change we'd been bracing for turned out to hand us a 12-month safety net and fix our auth and state headaches in one release.
- And the payoff for operators is a service that drops into Kubernetes without the usual stateful-app baggage.

Pre-1.0 still means pre-1.0 so we're not going to pretend the road is perfectly smooth from here. But the biggest source of uncertainty just got a lot more manageable, and the code you'd be building on is improving which each commit.

## Get involved

Vigil is a capability you own, and it gets better every time someone shows up. If any of the above made you want to poke at it:

- **Star and clone the repo** to follow along.
- **Open an issue** — the "why is this like this?" questions are how half of this cycle's improvements started.
- **Send a PR** — 89 got opened in five weeks; there's plenty of room for yours.
- **Come hang out in Discord** — feedback, code, and memes all count.

We'll have additional posts and updates for the upcoming 0.5.0 release.

Thanks for building this with us. See you in the commit graph.
