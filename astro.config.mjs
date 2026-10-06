import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { readingTimeRemarkPlugin } from './src/lib/reading-time.mjs';

// `astro dev`'s static server (unlike `astro preview` and GitHub Pages itself) does not
// fall back to `index.html` for directory requests under public/ (e.g. /AbcGame/).
// This restores that fallback in dev only, without touching any file under public/.
function publicDirIndexFallback() {
    return {
        name: 'public-dir-index-fallback',
        configureServer(server) {
            server.middlewares.use((req, _res, next) => {
                if (req.method === 'GET' && req.url && req.url.endsWith('/') && req.url !== '/') {
                    const publicPath = join(server.config.root, 'public', req.url, 'index.html');
                    if (existsSync(publicPath)) {
                        req.url += 'index.html';
                    }
                }
                next();
            });
        },
    };
}

export default defineConfig({
    site: 'https://vgerman256.github.io',
    base: '/',
    integrations: [sitemap()],
    vite: {
        plugins: [publicDirIndexFallback()],
    },
    markdown: {
        processor: unified({
            gfm: true,
            remarkPlugins: [readingTimeRemarkPlugin],
        }),
        shikiConfig: {
            themes: {
                light: 'github-light',
                dark: 'github-dark',
            },
        },
    },
});
