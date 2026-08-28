---
layout: post
title: "Lessons learned from building a harness for cyber security"
date: 2026-08-27
author: "Mayank Kumar"
category: "Research"
tags: [threat-hunting, agents, harness, architecture, engineering, research, product]
excerpt: "When and how to use code for controls - how my experience in building models led us to design an apparently new approach"
---

Those of you that know about DeepTempo or about me realize I’m a deep learning researcher and former product lead from industry. For example, while working with the Allen Institute in Seattle, I built multi-modal transformer models from the ground up.  Since joining DeepTempo as a founding AI engineer over two years ago, I’ve been working very closely with some of the most attacked organizations in the world, including tier one global service providers. From them \- and from my colleagues \- I’ve learned an enormous amount about the real world in cyber security.

In this blog I explain how we came to a new approach in building the updated harness within Vigil, the leading OpenSource AI SOC. Please provide any and all feedback. Thank you to our contributors and users who found time while hunting for nation state actors to educate me and our team on the intricacies of their role.

## **What is a Threat Hunt anyway?**

Threat hunting is part art, and part science. At least amongst the users we interviewed, the expertise of the individual and their understanding of the attacker informs how they act. To be helpful and to enable automated and trusted operations, Vigil must both capture that understanding and must learn from experience.   

We saw that threat hunters typically  start with a hypothesis: periodic outbound connections to rare external destinations might be command and control. A query finds a host reaching out every five minutes. You pivot to its process telemetry and find a concerning looking binary. You pivot to identity logs to see whose credentials ran it. You pivot to cloud audit logs to see what that identity touched.

A few pivots and each was a judgment call on evidence uncovered and connected by the hunt.

Now count the pivots. It is difficult to predict whether a hunt takes just a few or maybe dozens to complete. Sometimes the correct move on iteration three is to kill the branch, and knowing when is most of what separates a good hunter from a merely exhaustive one. Sometimes the honest ending is "nothing found, and also we cannot see cloud audit logs for this tenant at all," which is the more useful finding.

The science or at least craft of threat hunting is reflected in industry shared frameworks A couple of the prominent ones are:PEAK and TaHiTi.  PEAK, from Splunk SURGe, breaks the hunt into Prepare, Execute, and Act and TaHiTI, from a Dutch financial sector consortium, is blunter about the hard part: Define/Refine and Execute are interleaved, cycling an unpredictable number of times, ending in proven, disproven, or inconclusive, with pivoting treated as first class rather than as an exception.

Vigil's threat hunt workflow, like most AI SOCs, was assumed to be sequential, like a pipeline: threat hunter, then network analyst, then malware analyst, then threat intel, then reporter. It demonstrates beautifully however it does not treat pivoting or looping as first class citizens, they are somewhat hidden in the overarching workflow. Given how crucial pivoting, looping and especially abandoning are we thought that seemed a bit off.  Also given our heritage, some of us built the extremely extensible and popular StackStorm for complex automation that now powers organizations like Zscaler and Netflix, we thought it time to build a more solid foundation.  

The obvious fix, and the one our users tell us vendors pitching them are typically reaching for, is a better prompt. Describe the hunt, list the requirements, add a few "always" and "never" clauses, let it rip.  Then when the agent loops forever on iteration nine, add another clause. A reasonable-looking process that produces a two-thousand-word system prompt and an agent that still loops but in a hard to estimate or project way.

We took a very different approach in building a threat hunt harness in Vigil 0.5.0. Before I get into the details of our architecture, let me share with you the mental frame that we rallied around in building.  Its shape comes down to one sentence I kept repeating while we designed it: a prompt is not an instruction, it is a coordinate.

Remember, at inference the weights do not move. Every token you send conditions the forward pass, and that conditioning determines which learned behavior dominates. The prompt does not add capability; it determines which existing capability responds. So prompting is selection, and therefore the discipline is not exactly prompt writing. Instead, we see our responsibility is to enable Vigil to decide, every iteration, what the model sees and what it may do about it. 

Call it the selection function. That is the artifact. The prompt is just its output at one moment.

Once you understand the above, and build towards it,  you can start to far better  encode human knowledge into the constraints, and guides. An experienced traveler books a flight fast because of everything supplied silently: price is soft, aisle is hard, and I can just book it. Give an agent two stated constraints and it searches, returns empty, and searches again, because no turn has authority to call a constraint soft. Nothing can yield, so the loop has no exit. For hunting one challenge is that this unstated list is long: what makes a lead worth pursuing, what makes a branch dead, what a verdict requires, and when the hunt may stop.

![Diagram of the Vigil 0.5.0 threat hunt harness: a hunt spec seeds and human checkpoints gate a deterministic hunt controller that is the sole mutator of state and holds the termination predicate; the controller directs a single hunt lead, which reads a digest of the append-only hunt ledger and emits exactly one typed decision per turn from a closed set — INVESTIGATE, VALIDATE, CONCLUDE, PIVOT, DEEPEN, ABANDON — as a recommendation back to the controller; the lead dispatches specialist workers that may only append evidence to the ledger. The model recommends, the controller decides, and it refuses to conclude while any hypothesis is still active.](/assets/blog/2026-08-27-lessons-learned-building-a-harness-for-cyber-security/threat-hunt-harness.png){: style="width:min(860px, calc(100vw - 56px)); max-width:none; margin-left:50%; transform:translateX(-50%)"}

## **The harness**

TL;DR \- we stopped encoding scenarios as workflows. A ransomware workflow and an insider threat workflow and a beaconing workflow result in something very much like a playbook library, which is too close to the SOAR trap some of us encountered in building StackStorm. Because typical platforms are challenged to enumerate pivot trees, they lose their usefulness, are not updated, and they rot. Our approach is very different \- with Vigil: **the loop is fixed and scenario-independent, and scenarios are “just” more data.** A hunt spec declares the hypothesis seed, scope, techniques, data domains, budgets, and exit criteria.

**The hunt controller** is deterministic Python. It runs the state machine and is the only thing allowed to change state. Every decision crosses it. It is not an LLM and never will be.

**The hunt lead** is the only LLM in the loop. Each iteration it reads a digest of the ledger and emits one typed decision from a closed, versioned schema: `INVESTIGATE`, `EXPAND`, `PIVOT`, `DEEPEN`, `ABANDON`, `VALIDATE`, `HANDOFF_IR`, `CHECKPOINT`, `CONCLUDE`. Schema-constrained JSON with rationale and cited evidence IDs. Something the controller can act on and an auditor can read and nothing else.

**Specialist workers** are Vigil's agents plus MCP tools. They simply append evidence.  They cannot  hypothesize status, or adjust the  confidence level, or even alter the spending budget. 

**The hunt ledger** they append to is fundamental for a number of reasons including repeatability and transparency; the hunt ledger holds hypotheses with status and provenance, leads with deterministic priority scores, evidence linked to what it supports or weakens, the entity graph, the execution log, gaps, and budget state.

And then the division of tasks that we have seen makes a difference : The model recommends. The controller decides.

The hunt lead can emit `CONCLUDE`. The controller checks a termination predicate and refuses while any hypothesis is still active. Three of the four ways a hunt can end leave the survivors marked inconclusive rather than disproven, because the hunt stopped looking, it did not clear them. And the report gets written on every path out, including an aborted one, so a hunt that ran out of money still tells you what it could not see.

## **What that one decision cascades into**

**The detail that triggers a pivot is never the one that looks important.** That is the trouble with summarization: it is very good at discarding exactly the thing you turned out to need. So every evidence record keeps a stable ID and a retrievable raw payload, and `EXPAND` costs nothing against the iteration budget. Workers tag salience at capture time, which is the right moment and still a guess, and a wrong guess matters more than it sounds, because the compressor acting on it never has an off day: it will bury that record consistently, every iteration, forever. So the controller keeps a rule-based floor that can raise salience and never lower it. Code may promote; only a human may demote. Every digest also resurfaces a few routine records verbatim, so a bad tag gets more than one chance at being noticed. And each one renders the strongest case against every live hypothesis. When there is none, it says so, because a hypothesis nothing argues with is not strong, it is unexamined.

**Confidence is two different things, and only one of which is acted upon.** The tempting design is a single number: the hunt lead says how sure it is, the controller gates on that. We keep that number. `stated_confidence` goes into every decision snapshot and we read it later to see how calibrated the model actually was. It just never decides anything, because a self-report with consequences attached is still a guess even if it seems precise.  That gates behavior is `evidence_strength`, which the controller works out from things it can count: independent source systems corroborating, records contradicting, gaps still open, whether the load-bearing support sits entirely in fields an attacker could have written, whether the hypothesis survived being argued against, whether the queries reproduce. No 0.90-versus-0.89 cliff, and a reviewer can review the reasoning. That challenge does not wait for the verdict either: a hypothesis left active too long gets a cheap pass arguing the null against raw payloads, outside the framing that produced it. Lead scoring went the same way: an early draft had the model rank leads by expected information gain, which it cannot compute and will happily fake, so now the controller ranks and the model picks from the shortlist.

**Idling is a different failure from looping, and it looks like work.** A loop detector catches literal repeats. It does not catch an agent running perfectly sensible new queries that move nothing, which is the expensive failure, because it looks productive right until the budget is gone. So the controller folds the event log down to one question: did anything actually change? A status, a new entity, a resolved lead, a closed gap. After a few iterations where the answer is no, `DEEPEN` disappears from the action space on that branch. Note the mechanism. We did not tell the model to stop stalling. We took the stalling action away.

**Every decision is replayable, and not just by us.** Sooner or later an analyst asks why the thing gave up on a host, and there is one good answer, which is to show them. So every decision is stored with what the model emitted, the digest it was looking at when it decided, the model ID, the prompt and schema version, and the seed that set what got resurfaced. Open a finished hunt and the whole chain is there, including every query attempted and the ones that failed. The failures earn their place: a failed call is recorded as a gap rather than quietly skipped, because "we could not check" is not "we checked and found nothing," and enough gaps mean the hypothesis can only come back inconclusive. None of this makes the model deterministic. It makes it legible afterward.

## **The adversary writes part of your prompt**

One part of this is specific to security, and it strongly influenced our design.

Telemetry is attacker-influenced by definition. Process names, DNS labels, user-agent strings, file paths, log messages: these are all strings an adversary can choose, all flowing into the ledger and from there into the prompt.

An attacker who knows an LLM reads the logs will plant instructions in telemetry. A process named to claim it is an authorized pentest. A DNS TXT record carrying a jailbreak. A log line arguing, in plain English, for `ABANDON`.

This is not a corner case; at any scale at least for our sorts of users it is the expected adversary response. If your safety story is "the model is aligned and will not follow instructions found in data," you have made the adversary a co-author of your system prompt. And a prompt is a request, not a constraint, so adherence decays over long runs, exactly when stakes are highest.

The defenses we have built into Vigil layered, and do not rely upon "we told the model not to." **Evidence enters the prompt inside typed, delimited blocks tagged with provenance and whether the field is attacker-influenceable**. Workers sanitize at the boundary and flag instruction-like content as suspicious in its own right, because an attacker attempting injection is a detection opportunity. And every `ABANDON` must cite evidence IDs and pass a controller check: a branch cannot be abandoned on exculpatory claims found inside attacker-influenceable fields. Self-exonerating telemetry is never grounds to stop looking.

Each defense lives in deterministic code rather than in the prompt, and that is the pattern. You cannot defend the selection function using the thing being selected.

The rule extends to insider threat, which made sense once our users explained it to us; after all they are defending critical infrastructure and attackers see them as critical and extremely valuable. A socially-engineered analyst is a real threat model, so marking an entity benign appends a reversible, attributed suppression rather than erasing the flagged activity. Human feedback is an attested claim, not ground truth that deletes evidence: the human edition of the self-exonerating rule.

Vigil 0.5.0 ships the spine: the loop, the tool bridge, and a hunt running end to end with the three properties we cared about most: run, resume, and replay. Model-assisted entry is next, where a LogLM finding becomes the trigger, under the same rule as everything above: logs and LogLM-over-logs collapse into one source system.

## **What we learned**

**The loop's exit condition is much more than a detail.** Almost every agent failure we investigated traced back to a loop with no authority to stop. An action vocabulary without a termination predicate may become an expensive random walk.

**Typed decisions beat prose reasoning, in both directions.** The closed schema made the system auditable, which we expected, and better, which we did not anticipate. A model forced to pick `PIVOT` or `DEEPEN` and cite evidence IDs commits to a claim. A model writing paragraphs equivocates which both leads to sloppy thinking and also makes more challenging collaboration and validation.

**Nothing self-reported is used to gate the threat hunt.** For example, neither confidence, nor salience, nor even the model's own read on whether it is making progress alone are used to gate the hunt. It is all recorded for calibration; however gates depend solely on what the controller can count. Prompts are persuasion, controllers are enforcement, and anything that needs to be true like a gate therefore belongs in code. If you are writing "you MUST NEVER" in capitals, you are probably encountering, at least for security use cases, something that should be a guardrail in code. 

The deeper we dug into the threat hunts of our users, and built 0.5, the more I realized that the way we are framing the problem may well generalize past hunting and even past security. Because today the weights are frozen, everything you send is a coordinate, and the system deciding which coordinate to send is the system you are actually building. Prompt engineering is not all that impactful last mile of that. The real work is deciding what the model sees, what it may say, who may write to state, and when the loop is allowed to stop.

**Next Steps**

Now that Vigil is gaining the trust and usage of a large number of users, we are seeing them increasingly spin up many hunts and other processes in parallel. So we are doing a lot to make  multi-agent operations easier and more intelligent, including self-learning and memory that knows your environment better than you. Stay tuned and get started now by forking the repo from [github.com/Vigil-SOC/vigil](https://github.com/Vigil-SOC/vigil)

---

Vigil is Apache 2.0 and lives at [github.com/Vigil-SOC/vigil](https://github.com/Vigil-SOC/vigil). The harness shipped in [0.5.0](https://github.com/Vigil-SOC/vigil/releases/tag/v0.5.0). Benchmarks are at [socbench.org](https://socbench.org/).
