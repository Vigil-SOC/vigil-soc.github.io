---
layout: post
title: "Numbers You Can Check"
date: 2026-11-03 16:30:00 -0800
author: "Evan Powell"
category: "Community"
tags: [metrics, transparency, github, open-source, community]
excerpt: "We now publish Vigil's adoption figures daily in a public repository, unaltered, so anyone can check what we claim and tell us where our measures fall short."
---

<!-- IMAGE: optional banner, e.g. ![Numbers You Can Check](/assets/blog/2026-11-03-numbers-you-can-check/banner.png) -->

Today we begin publishing Vigil's adoption figures in a public repository, [github.com/Vigil-SOC/metrics](https://github.com/Vigil-SOC/metrics). A scheduled job pulls the figures from GitHub each day and commits them unaltered. Anyone can check what we claim, and anyone can tell us where our measures fall short.

## Stars

Open source projects, ours included, cite GitHub stars as a proxy for adoption. The proxy was always weak. A star costs one click, and vendors sell them by the thousand.

Researchers at Carnegie Mellon, North Carolina State and Socket built StarScout to detect fake stars at scale. They found that projects buying stars gain a brief rise in attention, about five times smaller than the rise real stars bring, and lose ground over the longer term.

Detection depended on one condition: anyone could list the accounts behind a star count and inspect them. New accounts with empty profiles, starring in lockstep, gave purchased stars away. In mid-2026 GitHub limited those listings to a repository's administrators and collaborators, citing misuse of the lists to harvest user data for spam.

GitHub made a reasonable choice for developers' privacy. As a consequence, outsiders can no longer audit a star count. A figure that only its owner can verify is, in practice, self-reported, and self-reported figures invite inflation.

We think evaluators of a security project should give stars little weight, and we would rather not ask anyone to take ours on faith.

## What we publish

- Views and unique visitors per day.
- Clones and unique cloners per day.
- Stars, forks, watchers and open issues, recorded daily since August 14, 2026.
- Commit history for each contributor.
- A methodology note that defines each measure and its limits.

GitHub keeps traffic data for fourteen days, then discards it. Our record therefore starts on July 31, 2026 and cannot reach further back.

## How we publish

A GitHub Actions job runs once a day in a private repository we use for operations. It reads Vigil's traffic and repository statistics from the GitHub API, records them in CSV files, and rebuilds a self-contained HTML dashboard.

A second step copies an allowlisted subset to the public repository: the daily traffic file, the stars and forks file, the contributor file, a monthly summary, the methodology note, and a dashboard built from those files alone. The step refuses to publish if any other file, or any referrer data, reaches the output. The public repository holds only data and documentation, committed by an automated job, with no workflows and no credentials. Anyone can clone it and open the dashboard offline, or load the CSV files into their own tools.

## Clones

A clone registers when someone copies the repository with git: a developer cloning it to read or build locally, or a CI pipeline cloning it on every run. Between July 31 and October 31, GitHub recorded 148,794 clones of Vigil, 113,902 of them in October.

Raw clones can overstate reach. From October 19 to 24, daily clones ran as high as 15,173 while unique cloners stayed below 650 and page views below 170. We read that pattern as automated pipelines, not a wave of new users. We publish those days as GitHub reported them rather than filter them by a rule of our own choosing.

Unique cloners come closer to a measure of reach. GitHub counts each cloner once per day, so a monthly sum still counts a returning cloner once for each day it returns. In October that sum was 9,614, an upper bound on the distinct parties who cloned Vigil.

Contributor counts need the same care. Our contributor list holds 37 accounts. Four belong to bots or coding agents.

## What we withhold

GitHub also reports certain sites that refer visitors to a repository. We collect that data and keep it private. Referrer data can contain the hostnames of organizations that reach Vigil from internal systems, such as a staging environment or a webmail server. Those organizations never agreed to be named, so we keep this information private.

## Better measures

Stars, clones and visits measure attention. People who rely on a project leave other evidence: issues and pull requests from outside the sponsoring company, how quickly maintainers respond, how widely commits spread across contributors, signed releases, and how many contributors return. We plan to publish several of these.

Tell us what we should measure, where our method can be improved, or where a figure looks off. Please open an issue at [github.com/Vigil-SOC/metrics](https://github.com/Vigil-SOC/metrics).
