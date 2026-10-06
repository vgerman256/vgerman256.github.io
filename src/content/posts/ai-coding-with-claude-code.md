---
title: "Getting started with AI coding using Claude Code"
description: "A practical primer on spec-first design and efficient day-to-day workflow when building web and mobile apps with Claude Code."
pubDate: 2026-08-29
draft: false
tags: ["ai", "claude-code", "workflow", "specs"]
---

I've spent the last few months building and rebuilding pet projects — this very site included — with [Claude Code](https://claude.com/claude-code) doing most of the typing. It's changed how I plan work as much as how I write it. This is the primer I wish I'd had on day one: how to think about specs, how to keep an AI coding session productive instead of chaotic, and a few things that differ between web and mobile work.

## What Claude Code actually is

Claude Code is a coding agent that runs in your terminal (or an IDE extension) with real tool access: it reads and edits files, runs shell commands, greps your codebase, and can run your test suite or dev server. The important shift from a chat-based AI assistant is that it operates *in* your project — it can verify its own work by running `pnpm build` or opening a browser, rather than just describing code for you to paste in.

That changes the skill you're actually practicing. You're not writing prompts to get a code snippet; you're directing an agent that has the same tools you do, and the leverage comes from how well you scope and sequence the work you hand it.

## Design before you code: specs are the interface

The single highest-leverage habit is writing a spec before asking for code — not a full requirements document, just enough that both you and the agent agree on what "done" looks like before any files change.

For this site, that's `specs/blog-spec-v1.0.md`: a short document describing the site's purpose, page structure, content model, and what's explicitly out of scope (no comments, no tag pages, no CMS). It was written once, before the Astro migration, and every later session can be pointed back at it instead of re-deriving intent from the code.

A workable spec for a small project answers four questions:

- **What exists on screen** — the pages or screens, and what's on each one.
- **What data shapes it** — for a blog, that's frontmatter fields like `title`, `pubDate`, `tags`; for an app, it's your core models.
- **What's explicitly not included** — scope creep is the main way AI coding sessions go sideways, because an agent will happily build the feature you didn't ask for if the boundary isn't stated.
- **What must never change** — this site's `CLAUDE.md` calls out a handful of frozen legacy pages that predate the Astro rewrite and are off-limits for "improvement." Naming these explicitly stops a well-meaning agent from refactoring code you deliberately left alone.

That last point generalizes: a project-level instructions file (`CLAUDE.md`, or equivalent) that states your stack, conventions, and hard boundaries is worth writing once and reusing across every session. It's the difference between re-explaining "we use pnpm, not npm" every conversation and never having to say it again.

## Specs scale down, not just up

You don't need a spec for a one-line fix. But for anything that touches more than one file or introduces a new concept, a few sentences of plan — written in chat, not necessarily a file — pays for itself. Claude Code's plan mode is built for exactly this: you describe the goal, the agent reads the relevant code and proposes an approach, and you approve or redirect *before* it starts editing. Redirecting a plan costs a sentence; redirecting a half-finished implementation costs a revert.

The pattern that works well in practice:

1. State the goal and any constraints in one or two sentences.
2. Let the agent explore the existing code and propose a plan.
3. Push back on anything that looks like unrequested scope (a new abstraction, a dependency you didn't ask for, a refactor of unrelated code).
4. Approve, then let it execute in one pass rather than approving line-by-line.

## Efficient coding sessions

A few habits make the difference between a session that ships and one that meanders:

**Keep tasks small and verifiable.** "Add a dark-mode toggle" is a good unit of work; "modernize the frontend" is not. Small tasks are easy to review in full, and easy to revert if wrong.

**Ask for the change, not the essay.** An agent that over-explains every edit is wasting your attention budget. If you want terse output, say so once — most tools remember that preference for the rest of the session.

**Let it verify itself.** Point the agent at your test suite, linter, or type-checker, and tell it to run them after changes rather than trusting the diff by eye. For this site, that's `pnpm build`, which runs `astro check` before bundling — a broken frontmatter field or a bad import fails loudly instead of shipping.

**Review diffs, not descriptions.** An agent's summary of what it changed is a claim, not a guarantee. Skimming the actual diff before accepting it catches the rare case where the summary and the edit disagree.

**Commit in small units.** Ask for a commit after each coherent change rather than one giant commit at the end of a long session — it keeps `git log` useful and makes any single change easy to revert without touching the rest.

**Don't let it invent requirements.** If an agent adds error handling for a case that can't happen, or a config flag nobody asked for, that's a sign the task was under-specified, not a sign the agent was being thorough. Tighten the ask next time.

## Web development specifics

For a static or server-rendered site like this one, the fast feedback loop is the browser itself: run the dev server, make the change, look at the page. Claude Code can drive a real browser to check its own frontend work, which matters most for CSS and layout, where a passing type-check tells you far less than seeing the rendered page.

A few things worth stating up front in a web project's spec or instructions file:

- The rendering strategy (static generation, server-side rendering, client hydration) — this shapes where an agent should even look for the fix to a bug.
- Which pages or files are legacy/frozen and shouldn't be refactored incidentally.
- The design tokens (colors, spacing, type scale) living in one place, so new components reuse them instead of hardcoding values.

## Mobile development specifics

Mobile work changes two things: you can't always "just look at it" as cheaply, and platform constraints are stricter than a browser's.

- **Simulators over guessing.** If your toolchain supports it, have the agent build and boot a simulator/emulator to check a UI change rather than reasoning about layout from code alone — mobile layout bugs (safe areas, keyboard overlap, orientation) are exactly the kind of thing that look fine in the diff and wrong on device.
- **State platform constraints explicitly.** Minimum OS version, target devices, offline behavior, permission prompts — these belong in the spec because they silently constrain implementation choices (which API is even available) in a way a web project rarely has to think about.
- **Treat native modules and permissions as a boundary.** Adding a new permission (camera, location, push notifications) has user-facing and store-review consequences beyond the code — reserve those decisions for yourself, and have the agent flag it rather than add it quietly to satisfy a feature request.
- **Cross-platform framework choice matters more up front.** Unlike a website, an app's framework decision (native, React Native, Flutter, etc.) is expensive to change later — this is the one decision worth a short written spec of its own before any code exists, since it shapes every subsequent session.

## A minimal starter workflow

If you're starting a new pet project today, this is roughly the sequence I'd use:

1. Write a one-page spec: what the app/site does, its core pages or screens, its data model, and what's out of scope.
2. Write a short project instructions file: stack, package manager, conventions, and anything frozen or off-limits.
3. Use plan mode for the first significant feature — scaffolding the project structure — and review the plan before letting it run.
4. Ship small, verifiable slices: one page, one feature, one component at a time, with a build/test check and a commit after each.
5. Revisit the spec when scope actually changes, so it stays the source of truth instead of drifting out of sync with the code.

None of this is unique to Claude Code — it's how good software gets built with human collaborators too. The main adjustment is that the "collaborator" can now execute a well-scoped plan in minutes instead of days, which means the bottleneck shifts almost entirely to how clearly you can state what you want before you start.
