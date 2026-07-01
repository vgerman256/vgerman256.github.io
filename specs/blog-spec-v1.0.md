# Personal Blog — Specification v1.0

**Stack:** Astro + Markdown + GitHub Pages
**Target executor:** Claude Code
**Status:** Ready for implementation
**Scope note:** Static site only. No comments, no admin UI, no backend, no database in v1.0. Those are deferred (see §14).

---

## 1. Summary & goals

Build a minimalist, typography-first personal blog as a fully static Astro site deployed to GitHub Pages, and migrate the owner's existing site onto it while preserving content and URLs. The public site ships near-zero JavaScript; "publishing" is a Git commit of a Markdown file that triggers an automated build and deploy.

Design intent: refined editorial minimalism — single column, generous whitespace, serif post titles, monospace metadata, one restrained accent color, system-aware light/dark. The reference look is the approved homepage mockup (date · reading time, title, one-line description, hairline separators, no cards/sidebars/thumbnails).

Non-goals for v1.0: dynamic features, user accounts, server-side anything.

## 2. Scope

**In scope (v1.0)**
- Astro project scaffolded, typed content collections for posts.
- Pages: home (post index), post detail, about, 404, RSS feed, sitemap.
- Design system (tokens + layout + components) matching the approved mockup.
- Markdown authoring with frontmatter, drafts, syntax highlighting, footnotes, reading time.
- SEO (per-page meta, OpenGraph/Twitter, canonical, JSON-LD, robots.txt).
- GitHub Actions build + deploy to GitHub Pages, custom domain.
- Migration of existing content and URL preservation.

**Out of scope (deferred — see §14)**
- Comments (planned v1.1 via Giscus or a separate API).
- Web-based authoring / admin (planned v1.2 via a Git-based CMS).
- Tag/category index pages (optional stretch; see T16).
- Search, newsletter, analytics dashboards.

## 3. Inputs required from owner

These block migration tasks (P5) only; everything else can proceed with the defaults noted. Ask once, near the start, and stop on T20–T22 until answered.

| # | Input | Needed for | Default if unspecified |
|---|-------|-----------|------------------------|
| I1 | Custom domain (e.g. `example.com`) | astro.config `site`, CNAME | Build for `https://<user>.github.io/<repo>` with `base` set |
| I2 | GitHub username + repo name | config, workflow | placeholder, owner edits |
| I3 | Existing site platform + repo/export | content migration | proceed with manual sample, flag |
| I4 | Current URL/permalink scheme (e.g. `/2016/02/03/slug.html`) | URL preservation / redirects | `/posts/<slug>/`, no redirects |
| I5 | Font choices (confirm or override the recommended trio in §8.3) | design tokens | recommended trio |

## 4. Tech stack & versions

- **Astro** — latest stable major. Use Content Layer API (`glob()` loader, `src/content.config.ts`).
- **Node** — 22 LTS or newer.
- **Package manager** — pnpm (commit `pnpm-lock.yaml`; the deploy action auto-detects it).
- **TypeScript** — strict (`astro/tsconfigs/strict`).
- **Integrations:** `@astrojs/rss`, `@astrojs/sitemap`.
- **Markdown:** built-in remark/rehype pipeline. `remark-gfm` (tables, footnotes, task lists), a reading-time remark plugin, Shiki for code highlighting (built into Astro).
- **Fonts:** self-hosted variable fonts via Fontsource (`@fontsource-variable/*`) — no external font CDN, for performance and privacy.

> Pin exact versions at implementation time to the current latest stable; do not copy version numbers from memory. Verify the `withastro/action` and `actions/checkout` major versions against the official Astro GitHub Pages deploy guide when writing the workflow.

## 5. Repository & project structure

```
/
├── .github/workflows/deploy.yml
├── public/
│   ├── CNAME                 # custom domain (if I1 provided)
│   ├── robots.txt
│   └── favicon.svg
├── src/
│   ├── content.config.ts     # collections + zod schema
│   ├── content/
│   │   └── posts/            # Markdown posts (one .md per post)
│   ├── components/
│   │   ├── BaseHead.astro    # <head>: meta, OG, canonical, JSON-LD
│   │   ├── Header.astro      # wordmark + nav
│   │   ├── Footer.astro
│   │   ├── PostListItem.astro
│   │   └── FormattedDate.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro  # html shell, theme, skip-link
│   │   └── PostLayout.astro  # article reading view
│   ├── pages/
│   │   ├── index.astro       # home / post index
│   │   ├── about.astro
│   │   ├── 404.astro
│   │   ├── rss.xml.js        # RSS endpoint
│   │   └── posts/[...slug].astro   # post detail (route shape per I4)
│   ├── styles/
│   │   └── global.css        # design tokens + base typography
│   └── lib/
│       └── reading-time.mjs  # remark plugin
├── astro.config.mjs
├── tsconfig.json
├── package.json
└── pnpm-lock.yaml
```

Route shape under `src/pages/posts/` is the default; if I4 specifies a different permalink scheme, adjust the route file and slug strategy accordingly (see §11).

## 6. Content model

**Collection:** `posts`, loaded with `glob()` from `src/content/posts/**/*.md`.

**Frontmatter schema (zod, in `content.config.ts`):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | post title |
| `description` | string | yes | one-line summary; used in list + meta |
| `pubDate` | date (coerced) | yes | publish date |
| `updatedDate` | date (coerced) | no | shown as "updated" if present |
| `draft` | boolean | no | default `false`; drafts excluded from prod build & RSS |
| `tags` | string[] | no | reserved; not surfaced in v1.0 unless T16 done |
| `slug` | string | no | URL override for migration (preserve old permalink) |
| `heroImage` | string | no | optional; not shown in list |

**Conventions**
- Filename → default slug; `slug` frontmatter overrides (critical for migration).
- Drafts: `draft: true` is rendered in `astro dev` but filtered out of production builds, RSS, and sitemap.
- Reading time computed at build by the remark plugin and exposed to layouts.
- Markdown supports inline HTML as an escape hatch; GFM for footnotes/tables.

## 7. Routing & pages

- `/` — home. Post index: reverse-chronological list of non-draft posts. Each row: `pubDate` + reading time (mono, tertiary), title (serif), description (sans, secondary), hairline separator. Matches the approved mockup. No pagination in v1.0 unless post count exceeds ~50 (then add simple pagination — stretch).
- `/posts/<slug>/` (or per I4) — post detail via `PostLayout`. Renders title, meta (date, updated, reading time), prose, footnotes, code blocks. Prev/next links optional (stretch).
- `/about/` — static about page (Markdown-driven or `.astro`).
- `/404` — minimal, in-style.
- `/rss.xml` — RSS 2.0 of non-draft posts; autodiscovery `<link>` in head.
- Sitemap — generated by `@astrojs/sitemap`.

## 8. Design system

Implement as CSS custom properties in `src/styles/global.css`; no UI framework. Refined minimalism: restraint and precision over decoration. Avoid generic defaults (no Inter/Roboto/system-font stack, no purple-on-white).

### 8.1 Color tokens

Define both themes via `prefers-color-scheme`; optional manual toggle (see §9). Values are a starting palette — keep the warm off-white paper feel and single warm accent.

```
Light:  --bg #FBFAF7  --text #1A1A18  --muted #57564F  --faint #8A8980
        --border #E6E3DB  --accent #D85A30  --code-bg #F3F1EA
Dark:   --bg #16150F  --text #ECEAE1  --muted #A9A79C  --faint #6F6E66
        --border #2A2926  --accent #E2724A  --code-bg #201F1A
```

Accent is used sparingly: wordmark mark, link hover/underline, active nav item. Body remains near-monochrome.

### 8.2 Layout & spacing
- Single centered column, content max-width ~68ch (≈640–680px); wider for full-bleed code if desired.
- Vertical rhythm in `rem` (1 / 1.5 / 2.4). Generous space between list items.
- Hairline separators: `1px solid var(--border)`.

### 8.3 Typography (recommended trio — owner confirms via I5)
- **Titles / wordmark:** `Fraunces` (variable serif, optical sizing) — editorial character.
- **UI / meta / nav / body:** `Hanken Grotesk` (variable sans) — clean, not Inter.
- **Code + dates:** `JetBrains Mono`.

Body reading size 18px, `line-height: 1.7`. Post title ~2rem, weight 500. Two weights only (400/500). Sentence case throughout. All self-hosted via Fontsource; preload the body font; `font-display: swap`.

### 8.4 Components
- **Header:** wordmark (serif) with small accent mark + minimal nav (Writing · About · RSS).
- **PostListItem:** as §7 home spec.
- **PostLayout prose:** styled headings, blockquotes, lists, tables, footnotes, images (rounded, captioned optional), and `<hr>`.
- **Code blocks:** Shiki, a muted theme aligned to the palette in both light/dark; rounded container, horizontal scroll, no line-number clutter (optional copy button is JS — keep optional/minimal).

## 9. Non-functional requirements
- **Performance:** Lighthouse ≥ 95 across all categories; target 100. Zero render-blocking JS on content pages.
- **JavaScript:** none by default. The only permitted JS is an optional no-flash theme toggle (tiny inline script in `<head>` to set theme before paint) — system preference is the default with or without it.
- **Accessibility:** semantic landmarks, visible focus states, skip-to-content link, `alt` on images, color contrast AA, `prefers-reduced-motion` respected.
- **SEO:** unique `<title>`/description per page, canonical URLs, OpenGraph + Twitter card meta, `BlogPosting` JSON-LD on posts, `robots.txt`, sitemap, RSS autodiscovery.
- **Build hygiene:** no console errors/warnings; `astro check` passes; type-safe content access.

## 10. Build & deploy

### 10.1 astro.config.mjs
- `site`: custom domain from I1 (or the github.io URL).
- `base`: `/` for a custom domain or a user/org root repo; `/<repo>/` only for a project-page repo without custom domain.
- Add `@astrojs/sitemap`; configure Shiki themes in `markdown.shikiConfig`; register the reading-time remark plugin and `remark-gfm`.

### 10.2 GitHub Actions workflow (`.github/workflows/deploy.yml`)
Use Astro's official action. Build job checks out and runs `withastro/action` (auto-detects pnpm); deploy job publishes via `actions/deploy-pages`. Required permissions: `contents: read`, `pages: write`, `id-token: write`; `concurrency: pages`. Trigger on push to `main` + `workflow_dispatch`. Pin to current latest major versions verified against the official Astro deploy guide.

### 10.3 Pages settings & domain
- Repo Settings → Pages → Source = **GitHub Actions**.
- `public/CNAME` containing the custom domain; configure DNS (A/AAAA or CNAME) and enable "Enforce HTTPS".
- `.nojekyll` is handled by the action; do not rely on Jekyll.

**Acceptance:** push to `main` publishes the site to the custom domain over HTTPS automatically.

## 11. Migration plan (from existing site)

Depends on I3/I4. Sequence:

1. **Inventory:** crawl the existing site's sitemap; record every live URL and its target slug. This list is the migration's source of truth and acceptance checklist.
2. **Content import:** convert existing posts to Markdown with the §6 frontmatter. Map old fields → new (title, date, description, tags). Set `slug` to preserve the exact existing path where the new default differs.
3. **Assets:** move images into the repo (`src/assets` for optimization or `public/` for verbatim paths); rewrite references; keep paths stable where they were public.
4. **URL preservation:** for any old path that does not map 1:1, add an Astro `redirects` entry. Note the GitHub Pages caveat: static hosting cannot emit true 301s for arbitrary paths — Astro emits meta-refresh redirect pages; pair each with a `rel=canonical` to the new URL. Document any unavoidable URL changes.
5. **Feeds & metadata:** keep the RSS feed at its previous path if the old site published one (alias `/rss.xml` or the prior filename) so existing subscribers don't break.
6. **Validation:** every URL from step 1 must resolve to a 200 or a redirect to the correct new URL. Verify RSS validates and sitemap lists all posts.

## 12. Implementation tasks

Phased and numbered. Each task lists its acceptance check.

**P0 — Scaffold**
- **T1** Init Astro project (pnpm, TS strict, blog starter as base). *Accept:* `pnpm dev` serves a default page; `astro check` clean.
- **T2** Add integrations (`@astrojs/rss`, `@astrojs/sitemap`) and Markdown plugins (`remark-gfm`, reading-time). *Accept:* build succeeds with integrations registered.

**P1 — Content model**
- **T3** Define `posts` collection + zod schema (§6) in `content.config.ts`. *Accept:* a sample post with full frontmatter type-checks; bad frontmatter fails the build.
- **T4** Draft handling: exclude `draft: true` from prod build, RSS, sitemap; include in dev. *Accept:* a draft is visible in `dev`, absent from `pnpm build` output.
- **T5** Reading-time remark plugin exposing minutes to layouts. *Accept:* post meta shows a sensible reading time.

**P2 — Design system**
- **T6** `global.css` color tokens + light/dark via `prefers-color-scheme` (§8.1). *Accept:* both themes render correctly by toggling OS setting.
- **T7** Self-host fonts via Fontsource (§8.3); typography base styles. *Accept:* fonts load locally (no external font requests in network tab); FOUT acceptable.
- **T8** `BaseLayout` (html shell, skip-link, head slot) + `Header` + `Footer`. *Accept:* matches mockup header/footer; a11y landmarks present.
- **T9** Home index + `PostListItem` matching the approved mockup. *Accept:* visual parity with mockup (date·reading-time, serif title, description, hairlines).
- **T10** `PostLayout` prose styles (headings, quotes, lists, tables, footnotes, images, hr). *Accept:* a content-rich sample post renders cleanly.
- **T11** Shiki code highlighting themed to palette, light/dark. *Accept:* code blocks legible and on-palette in both themes.

**P3 — Pages & features**
- **T12** About page + 404 page in-style. *Accept:* both reachable and styled.
- **T13** `BaseHead` SEO: per-page title/description, canonical, OG/Twitter, `BlogPosting` JSON-LD, RSS autodiscovery. *Accept:* meta correct on home and a post; JSON-LD validates.
- **T14** RSS endpoint (non-drafts). *Accept:* `/rss.xml` validates in an RSS validator.
- **T15** `robots.txt` + sitemap wired to `site`. *Accept:* sitemap lists all non-draft posts; robots references it.
- **T16** *(stretch)* Tag index pages `/tags/<tag>/`. *Accept:* tags link to filtered lists. Skip if not requested.

**P4 — Deploy**
- **T17** `astro.config.mjs` `site`/`base` per I1. *Accept:* build output has correct absolute URLs.
- **T18** `deploy.yml` via `withastro/action` + `actions/deploy-pages` (§10.2). *Accept:* Action runs green on push to `main`.
- **T19** `public/CNAME` + Pages source = GitHub Actions; HTTPS enforced. *Accept:* site live on custom domain over HTTPS.

**P5 — Migration** *(blocked on I3/I4)*
- **T20** Inventory existing URLs from sitemap. *Accept:* complete URL list committed as `migration/urls.txt`.
- **T21** Import posts → Markdown with frontmatter + `slug` preservation; migrate assets. *Accept:* all posts build; spot-checked content matches originals.
- **T22** URL preservation: routes/redirects so every old URL resolves; preserve prior RSS path; document unavoidable changes. *Accept:* every URL in `migration/urls.txt` returns 200 or a correct redirect.

**P6 — Polish & verify**
- **T23** Lighthouse pass (≥95 all categories) on home + a post; fix regressions. *Accept:* scores met.
- **T24** A11y pass (axe/manual): focus, skip-link, contrast, reduced-motion. *Accept:* no critical issues.
- **T25** Final `astro check` + clean build + no console errors. *Accept:* all green.

## 13. Definition of done (v1.0)
- Site builds and auto-deploys to the custom domain over HTTPS on push to `main`.
- All §7 pages work; home matches the approved mockup; light/dark both correct.
- Posts render with code highlighting, footnotes, reading time; drafts excluded in prod.
- RSS and sitemap valid; SEO meta + JSON-LD present.
- Every migrated URL resolves (200 or correct redirect).
- Lighthouse ≥95 all categories; zero JS on content pages (except optional theme toggle); no console errors; `astro check` clean.

## 14. Future roadmap (not in v1.0)
- **v1.1 — Comments.** Drop-in Giscus (GitHub login, zero backend) on post pages; or the previously designed self-hosted comment API on Raspberry Pi. No site re-architecture required — the site stays static.
- **v1.2 — Web authoring.** Git-based CMS (Decap or Tina) as an admin layer over the same repo; still no dedicated server.
- **Later.** Tag/category indexes, full-text search, post series, prev/next.

## 15. Appendix

### 15.1 Example post
```markdown
---
title: "Ports and adapters without the dogma"
description: "When hexagonal architecture earns its keep, and how to tell when it's just ceremony."
pubDate: 2026-06-04
draft: false
tags: ["architecture", "dotnet"]
# slug: "ports-and-adapters"   # set to preserve an existing permalink
---

Intro paragraph here. Inline `code`, **emphasis**, and a footnote.[^1]

## A heading

```csharp
public interface ICommentStore { /* ... */ }
```

[^1]: Footnote text.
```

### 15.2 Notes for the executor
- Prefer the official Astro blog starter as the scaffold base, then strip it down to the minimalist design rather than building from an empty project.
- Do not introduce client-side frameworks or UI libraries; vanilla Astro + CSS only.
- Treat the approved homepage mockup as the visual source of truth for the index.
- Keep all decisions reversible and the content portable (Markdown is the source of truth).
