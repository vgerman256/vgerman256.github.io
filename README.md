# vgerman256.github.io
A site on my projects, interests and maybe even passions. Let's have some fun here.

## Local development

Requires Node.js 22+ and [pnpm](https://pnpm.io/) (`npm install -g pnpm` if you don't have it).

```sh
pnpm install       # install dependencies
pnpm dev           # start the dev server at http://localhost:4321
pnpm build         # type-check (astro check) + production build to dist/
pnpm preview       # serve the dist/ build locally, to test the real production output
```

When testing locally, check both the blog (`/`, `/about/`, `/posts/<slug>/`, `/rss.xml`) and the
frozen static pages under `public/` (`/chess.html`, `/math.html`, `/abcgame.html`, `/AbcGame/`,
`/softservices.html`) — the latter are plain HTML/JS carried over as-is from before the Astro
migration and must keep working unmodified. See `CLAUDE.md` for the full list and why they're frozen.

## Adding a new post

Each post is a single Markdown file — there's no manifest or index to update; the home page,
`/posts/<slug>/`, and the RSS feed are all generated automatically from the `posts` content
collection (`src/content.config.ts`).

1. Create `src/content/posts/<slug>.md` with frontmatter:

    ```md
    ---
    title: "Post title"
    description: "One-line summary, used on the home page and in RSS."
    pubDate: 2026-08-29
    draft: false
    tags: ["tag1", "tag2"]
    projectUrl: "/my-project.html"   # optional — renders a "Launch this project" link
    heroImage: "/some-image.png"    # optional
    slug: "custom-url-slug"         # optional — overrides the URL, defaults to the filename
    updatedDate: 2026-09-01         # optional — shown if the post is revised later
    ---

    Post body in Markdown here.
    ```

2. Set `draft: true` while writing — draft posts render in `pnpm dev` but are excluded from
   production builds, RSS, and the sitemap. Flip to `draft: false` (or remove it) to publish.
3. Reading time is computed automatically at build time from the post body — no frontmatter field
   needed.
4. Run `pnpm dev` and check the post renders correctly at `/posts/<slug>/` and appears on the home
   page in the right (reverse-chronological) position.

See an existing file such as `src/content/posts/chess.md` for a full example.

## Editing the home page

The home page (`src/pages/index.astro`) lists all non-draft posts automatically, newest first —
you don't need to edit it when adding or removing posts. Edit it only when changing the page's
layout, intro copy, or how each post entry is rendered (the latter is templated via
`src/components/PostListItem.astro`).

## Todo

- [ ] Add a free call-booking widget to the Software Services page (Cal.com recommended — free, no forced branding, embeds as iframe). See plan in `.claude/plans/glowing-cooking-bear.md`.
