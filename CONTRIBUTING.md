# Contributing to the Vigil SOC Blog

The blog at [vigilsoc.org/blog/](https://vigilsoc.org/blog/) is community-driven. Posts are plain markdown files submitted via pull request — no CMS, no build system to learn, no editorial gatekeeping beyond a quick review.

This guide covers blog posts. For the documentation and other site pages that live in this same repository, see [Contributing documentation or site pages](#contributing-documentation-or-site-pages) below.

## How to submit a post

### 1. Fork and clone

Fork [vigil-soc/vigil-soc.github.io](https://github.com/vigil-soc/vigil-soc.github.io) and clone your fork.

### 2. Create your post file

Add a markdown file to the `_posts/` directory. The filename **must** follow this format:

```
_posts/YYYY-MM-DD-your-post-title.md
```

Example: `_posts/2026-08-15-building-a-detection-agent-with-vigil.md`

### 3. Add front matter

Every post must start with YAML front matter between `---` delimiters:

```markdown
---
layout: post
title: "Your Post Title Here"
date: 2026-08-15
author: "Your Name"
category: "Tutorial"
tags: [detection, agents, tutorial]
excerpt: "A one or two sentence summary of your post. This appears on the blog index and in page meta."
---

Your content starts here...
```

**Front matter fields:**

| Field | Required | Notes |
|---|---|---|
| `layout` | Yes | Always `post` |
| `title` | Yes | Shown as the page heading |
| `date` | Yes | Must match the filename date (`YYYY-MM-DD`) |
| `author` | Recommended | Your name or handle |
| `category` | Recommended | One of: `Research`, `Tutorial`, `Community`, `Engineering` |
| `tags` | Optional | Array of lowercase tags |
| `excerpt` | Recommended | 1–2 sentence summary, used in the blog index and SEO meta |

### 4. Write your post

The post body is standard [GitHub Flavored Markdown](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax). Code blocks with language tags get syntax highlighting:

````markdown
```python
def detect_anomaly(events):
    ...
```
````

### 5. Open a pull request

Push your branch and open a PR against `main`. The title should be your post title. Include a brief note in the PR description if there's context the reviewer needs.

Once merged, GitHub Pages rebuilds automatically and your post appears on the blog within a minute or two.

## Guidelines

- **One post per PR.** Makes review easier and keeps history clean.
- **Your own work.** Don't submit content you don't have the right to publish.
- **Relevant to security operations, AI, or the Vigil project.** This isn't a general tech blog.
- **Accurate.** We'll push back on claims that seem wrong. Bring receipts.
- **No marketing copy.** Vendor pitches get closed without review.

## Local preview (optional)

To preview your post locally before submitting:

```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

Then open [http://localhost:4000/blog/](http://localhost:4000/blog/).

You'll need Ruby and Bundler installed. The `Gemfile` in the repo pins the `github-pages` gem so your local build matches production exactly.

## Contributing documentation or site pages

The documentation under `docs/` and the other pages of vigilsoc.org live in this repository too, and are contributed the same way: fork, edit, and open a pull request against `main`.

- Docs pages are Markdown files in `docs/` with front matter at the top — `layout: docs`, a `title`, and a `permalink` (for example `/docs/agents/`). Match the front matter of a neighbouring page.
- Keep claims about the product accurate to the current release of [Vigil](https://github.com/Vigil-SOC/vigil): check paths, counts, and behaviour against that repository rather than against an older page.
- The local preview above renders the whole site, documentation included, so you can check a docs change at its permalink before submitting.

## Questions?

Open a GitHub Discussion or drop into the community on [the community page](https://vigilsoc.org/community/).
