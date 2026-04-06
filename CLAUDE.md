# CLAUDE.md — Project Rules & Code Style

## Project Overview

Static personal website (no build tools, no package manager). Pure HTML/CSS/JS files served directly. Pages: `index.html` (home), `chess.html` (chess game), `math.html` (function grapher), `about.html`.

## Stack

- **HTML5** — semantic elements (`<header>`, `<main>`, `<footer>`, `<dialog>`)
- **CSS3** — custom properties, flexbox, keyframe animations
- **Vanilla JS** — ES6+, modules, async/await
- **Bootstrap 3.4.1** — grid and tab components (CDN)
- **jQuery 3.7.1** — DOM utilities (CDN)
- **PixiJS 8.16.0** — math grapher WebGL rendering (CDN)
- **Stockfish.js + WASM** — chess engine (local `/js/`)

No bundler, no TypeScript, no linting tools.

## File Structure

```
/
├── index.html
├── chess.html
├── math.html
├── about.html
├── css/
│   └── mainstyle.css      # Shared stylesheet (imported on all pages)
└── js/
    ├── chess.js            # Chess library (do not modify)
    ├── StockfishWeb.js     # Stockfish wrapper
    └── stockfish.*         # Engine files (do not modify)
```

## HTML Conventions

- **4-space indentation** throughout
- All pages link `css/mainstyle.css`
- Bootstrap grid: use `container` or `container-fluid`; tabs with `nav nav-tabs` + `tab-content`
- Element IDs and class names: **kebab-case** (e.g. `canvas-chess`, `button-container`, `notification-container`)
- Avoid deprecated attributes like `align="center"` — use CSS instead
- `<canvas>` elements for all graphics rendering
- `<dialog>` for modal confirmations
- Footer always contains visitor counter image + ad iframe

## CSS Conventions

- **4-space indentation**
- CSS custom properties in `:root`:
  ```css
  :root {
      --primary-bg: powderblue;
  }
  ```
- Prefer ID selectors for page-specific elements; class selectors for reusable components
- Keyframe animations defined in `mainstyle.css` (e.g. `slideIn`, `fade-out`)
- Font family: `verdana`
- Z-index layers: notifications at `9999`, modals at `1000`
- Canvas sizing done via JS (`getBoundingClientRect`) — do not set fixed canvas dimensions in CSS

## JavaScript Conventions

- **4-space indentation**
- **camelCase** for variables and functions: `selectedSquare`, `handleCanvasClick`
- **UPPER_SNAKE_CASE** for constants: `STORAGE_KEY`, `wasmSupported`
- **PascalCase** for classes: `Chess`, `StockfishWeb`
- Prefer `let`/`const` over `var`
- Use `===` (strict equality), not `==`
- Use single quotes for strings (preferred), template literals for interpolation
- Arrow functions for callbacks: `element.addEventListener('click', () => { ... })`
- `async/await` for async operations; wrap in `try/catch`
- Array methods: `.map()`, `.forEach()`, `.find()`, `.filter()`
- Object/array destructuring and spread operator where appropriate

**Module pattern:**
```js
import { Chess, Move } from './js/chess.js';
window.Chess = Chess;  // export to global scope for cross-script access
```

**Canvas drawing pattern:**
```js
ctx.save();
ctx.translate(x, y);
// ... draw
ctx.restore();
```

**Error handling:**
```js
try {
    const f = new Function('x', 'Math', `return ${formula};`);
    return f(x, Math);
} catch {
    return undefined;
}
```

**Persistence:** use `localStorage` with a named `STORAGE_KEY` constant.

## Adding New Pages

1. Create `pagename.html` at the root
2. Include Bootstrap 3.4.1 and jQuery 3.7.1 from CDN (match existing version)
3. Link `css/mainstyle.css`
4. Use `<header>`, `<main>`, `<footer>` structure
5. Footer must include visitor counter + ad iframe (copy from existing page)
6. Add a link/tab to `index.html` navigation

## What Not To Do

- Do not introduce a build system, bundler, or package manager
- Do not add TypeScript
- Do not upgrade Bootstrap (site uses 3.x, not 4.x/5.x)
- Do not modify `chess.js`, `stockfish.js`, `stockfish.wasm`, or `stockfish.wasm.js`
- Do not use `document.write()`
- Do not add inline `onclick=` attributes — use `addEventListener` instead
- Do not add unnecessary abstractions for one-off operations
