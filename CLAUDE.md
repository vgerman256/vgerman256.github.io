# CLAUDE.md — Project Rules & Code Style

## Project Overview

Personal blog + project showcase, built with Astro and deployed to GitHub Pages via GitHub Actions. Home (`/`) is a reverse-chronological list of short posts, one per pet project; `/about/` holds the owner's bio. See `specs/blog-spec-v1.0.md` for the full original spec this site was built from.

## ⚠️ Frozen static passthroughs — read this first

These files live under `public/` and are copied verbatim to the deployed site. **They must never be edited, reformatted, or "improved."** They predate the Astro migration, are fully functional as-is, and are out of scope for any refactor, lint, or style pass:

- `public/math.html`, `public/abcgame.html`, `public/softservices.html`
- `public/js/**` (`StockfishWeb.js`, `stockfish.*`: the Stockfish engine and its worker wrapper)
- `public/AbcGame/**` (a separate Flutter-built app, embedded via iframe from `abcgame.html`)
- `public/css/mainstyle.css` (required by `math.html` and `abcgame.html` — do not delete or rename)

If a change to any of these is ever genuinely needed, treat it as an explicit exception requiring the user's direct sign-off — not routine work. `public/softservices.html` additionally is intentionally **not linked** from the site nav/home; don't add a link to it without being asked.

The chess game (`/chess/`, see `specs/chess-overhaul-v2.0.md`) is a full-screen Astro page:

- **Structure:** `src/pages/chess.astro` uses `GameLayout` and the components in `src/components/chess/`.
- **Scripts:** the TypeScript modules in `src/scripts/chess/`, bundled by Astro.
- **Rules:** the npm `chess.js` package, pinned to an exact version.
- **Engine:** the only frozen script it loads is `public/js/StockfishWeb.js` (`is:inline`, typed in `src/scripts/chess/stockfish-web.d.ts`). It is called only through `src/scripts/chess/engine.ts`, which queues requests one at a time.
- **Runtime styles:** squares, pieces, history entries, toasts and confetti are created by the scripts at runtime, so style them with `:global()`.
- **Game logic:** `src/scripts/chess/game.ts` is a deliberate port of the old game flow. Known logic bugs are tracked in `specs/chess-known-issues.md` and fixed as separate tasks, not as part of UI work.
- **Old link:** `public/chess.html` is only a redirect to `/chess/` for old links.

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
│   ├── math.html, abcgame.html, softservices.html                # frozen, see above
│   ├── chess.html, about.html                                    # redirects to /chess/ and /about/ for old links
│   ├── css/mainstyle.css                                         # frozen, required by math/abcgame
│   ├── js/, AbcGame/                                             # frozen
│   ├── robots.txt, favicon.svg
├── src/
│   ├── assets/screenshots/     # post images, referenced relatively from .md (optimized by sharp)
│   ├── assets/chess/pieces/    # SVG piece sets (cburnett, chessnut) + licenses README
│   ├── content.config.ts       # posts collection + zod schema
│   ├── content/posts/*.md      # one .md per post
│   ├── content/about.md        # /about/ page text + profile header frontmatter
│   ├── components/             # BaseHead, Header, Footer, PostListItem, FormattedDate, PostIcon (shared SVG icons)
│   ├── components/chess/       # chess page parts: GameMenu, ChessBoard, PlayerStrip, GamePanel, ChessDialogs, ChessIcon
│   ├── layouts/                # BaseLayout (html shell), PostLayout (article view + end-of-post navigation), GameLayout (full-screen game shell)
│   ├── pages/                  # index, games, chess, about, 404, rss.xml.js, posts/[...slug].astro
│   ├── styles/global.css       # design tokens + base typography
│   ├── lib/icons.ts            # icon names shared by PostIcon and the posts schema
│   ├── lib/posts.ts            # getSortedPosts(): the one post order used by the home list and newer/older links
│   ├── lib/reading-time.mjs    # remark plugin
│   └── scripts/chess/          # chess client code: main (wiring), game (flow), board-view, notation, engine, effects, prefs
├── astro.config.mjs, tsconfig.json, package.json, pnpm-lock.yaml
└── specs/                      # versioned plans: blog-spec-v1.0.md (original design), chess-overhaul-v2.0.md, chess-known-issues.md
```

## Content authoring — adding a post

1. Add `src/content/posts/<slug>.md` with frontmatter: `title`, `description`, `pubDate`, optional `updatedDate`, `draft`, `tags`, `slug` (URL override), `heroImage` (image path relative to the post, e.g. `../../assets/screenshots/foo.png`; shown above the article and used as the social preview image), `projectUrl` (link to a live project page, rendered as a play card at the end of the post), `projectLabel` (the card's text, default "Launch this project"), `icon` (one of the names in `src/lib/icons.ts`, shown in the post list and on the play card; to add a new icon, add its name there and its SVG in `PostIcon.astro`).
2. `draft: true` renders in `astro dev` but is excluded from production builds, RSS, and the sitemap.
3. Reading time is computed automatically at build time — no frontmatter field needed.
4. No manifest or index file to update — the home page and RSS feed are generated from the collection automatically.

## Planning

- Before starting any code changes, save every approved implementation plan to `specs/<topic>-vX.Y.md` (e.g. `specs/chess-overhaul-v2.0.md`). Implementation starts only after the plan is in `specs/`.

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
