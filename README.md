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

## Todo

- [ ] Add a free call-booking widget to the Software Services page (Cal.com recommended — free, no forced branding, embeds as iframe). See plan in `.claude/plans/glowing-cooking-bear.md`.
