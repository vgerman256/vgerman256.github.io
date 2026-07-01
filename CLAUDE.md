# CLAUDE.md — Project Rules & Code Style

## Project Overview

Personal blog + project showcase, built with Astro and deployed to GitHub Pages via GitHub Actions. Home (`/`) is a reverse-chronological list of short posts, one per pet project; `/about/` holds the owner's bio. See `specs/blog-spec-v1.0.md` for the full original spec this site was built from.

## ⚠️ Frozen static passthroughs — read this first

These files live under `public/` and are copied verbatim to the deployed site. **They must never be edited, reformatted, or "improved."** They predate the Astro migration, are fully functional as-is, and are out of scope for any refactor, lint, or style pass:

- `public/chess.html`, `public/math.html`, `public/abcgame.html`, `public/softservices.html`
- `public/js/**` (`chess.js`, `chess-game.js`, `StockfishWeb.js`, `stockfish.*`)
- `public/AbcGame/**` (a separate Flutter-built app, embedded via iframe from `abcgame.html`)
- `public/css/mainstyle.css` (required by the three passthrough HTML pages above — do not delete or rename)

If a change to any of these is ever genuinely needed, treat it as an explicit exception requiring the user's direct sign-off — not routine work. `public/softservices.html` additionally is intentionally **not linked** from the site nav/home; don't add a link to it without being asked.

## Stack

- **Astro** (Content Layer API — `glob()` loader, `src/content.config.ts`)
- **TypeScript** — strict (`astro/tsconfigs/strict`)
- **pnpm** — package manager; `pnpm-lock.yaml` is committed
- **Markdown** — built-in remark/rehype pipeline, `remark-gfm`, a custom reading-time remark plugin (`src/lib/reading-time.mjs`), Shiki for code highlighting
- **Fonts** — self-hosted via Fontsource (`@fontsource-variable/fraunces`, `hanken-grotesk`, `jetbrains-mono`); no external font CDN
- **Integrations** — `@astrojs/rss`, `@astrojs/sitemap`
- **Deploy** — GitHub Actions (`.github/workflows/deploy.yml`) via `withastro/action` + `actions/deploy-pages`, no custom domain (`site: https://vgerman256.github.io`, `base: '/'`)

No client-side UI framework. Vanilla Astro components + plain CSS only, on new pages — never reintroduce Bootstrap/jQuery outside the frozen passthrough files listed above (they stay CDN-only, isolated to those files).

## File Structure

```
/
├── .github/workflows/deploy.yml
├── public/
│   ├── chess.html, math.html, abcgame.html, softservices.html   # frozen, see above
│   ├── css/mainstyle.css                                         # frozen, required by the above
│   ├── js/, AbcGame/                                             # frozen
│   ├── robots.txt, favicon.svg
├── src/
│   ├── content.config.ts       # posts collection + zod schema
│   ├── content/posts/*.md      # one .md per post
│   ├── components/             # BaseHead, Header, Footer, PostListItem, FormattedDate
│   ├── layouts/                # BaseLayout (html shell), PostLayout (article view)
│   ├── pages/                  # index, about, 404, rss.xml.js, posts/[...slug].astro
│   ├── styles/global.css       # design tokens + base typography
│   └── lib/reading-time.mjs    # remark plugin
├── astro.config.mjs, tsconfig.json, package.json, pnpm-lock.yaml
└── specs/blog-spec-v1.0.md     # original design spec
```

## Content authoring — adding a post

1. Add `src/content/posts/<slug>.md` with frontmatter: `title`, `description`, `pubDate`, optional `updatedDate`, `draft`, `tags`, `slug` (URL override), `heroImage`, `projectUrl` (link to a live project page, rendered as a "Launch this project" link).
2. `draft: true` renders in `astro dev` but is excluded from production builds, RSS, and the sitemap.
3. Reading time is computed automatically at build time — no frontmatter field needed.
4. No manifest or index file to update — the home page and RSS feed are generated from the collection automatically.

## Astro/CSS/TS Conventions

- 4-space indentation in `.astro`, `.ts`, `.css`, and `.md` frontmatter, consistent with the rest of the repo.
- kebab-case for CSS classes and content slugs.
- camelCase for TS/JS variables and functions; PascalCase for components.
- CSS custom properties in `:root` (see `src/styles/global.css`) for color tokens; both light and dark values defined via `prefers-color-scheme`.
- Prefer scoped `<style>` blocks inside `.astro` components over global CSS, except for tokens/base typography in `global.css`.

## What Not To Do

- Do not edit, reformat, or move the frozen static passthrough files listed above.
- Do not add a client-side UI framework (React/Vue/etc.) — vanilla Astro + CSS only.
- Do not reintroduce Bootstrap or jQuery into any new Astro page/component.
- Do not use `npm`/`yarn` — this project standardizes on `pnpm`.
- Do not add tag/category index pages, comments, search, or an admin/CMS layer — explicitly deferred (see `specs/blog-spec-v1.0.md` §14).
- Do not add unnecessary abstractions for one-off operations.
