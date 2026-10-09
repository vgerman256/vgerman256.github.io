# Chess v2.3: a light outline around black piece icons in dark mode

## Problem

In dark mode, black pieces in the captured-pieces list next to the player names are almost invisible. The same goes for the small black piece icons in the move list and in the review status line.

These icons (`.fig`, made by `figurine()` in `src/scripts/chess/notation.ts`) use the board's piece SVGs. In both piece sets (cburnett and chessnut), a black piece is a black shape with a black outline, so on the dark panels (`--g-bg: #14120E`) its edge disappears.

Light mode needs no change: white pieces in both sets have a black outline, which shows clearly on the light background.

## Fix

One rule in `src/pages/chess.astro`, next to the shared `.chess-app .pc` rule. In dark mode, every black `.fig` icon gets a thin light outline made of two tight `drop-shadow()` filters. Unlike `box-shadow`, `drop-shadow()` follows the shape of the piece.

```css
@media (prefers-color-scheme: dark) {
    .chess-app .fig[data-piece^='b'] {
        filter:
            drop-shadow(0 0 0.5px rgb(255 255 255 / 0.75))
            drop-shadow(0 0 0.5px rgb(255 255 255 / 0.75));
    }
}
```

- Board pieces, the menu and the dialogs are not affected. They don't use `.fig`.
- No script changes.

## Fix 2: the first captured piece is clipped

Found while testing the outline. In the captured list, every piece has a negative left margin so the pieces overlap, and that includes the first one. Because `.captured` has `overflow: hidden`, the left edge of the first piece is cut off, for both colors.

`PlayerStrip.astro` applies the negative margin only to `.fig + .fig`, so pieces still overlap each other but the first one is fully visible.

## Check

1. Run `pnpm build`.
2. In the browser (headless Chrome against `pnpm preview`), look at the captured list, the move list and the review status:
   - in dark and light mode;
   - with both piece sets.
