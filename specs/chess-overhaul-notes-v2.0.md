# Chess overhaul v2.0: implementation notes

What was actually built for [chess-overhaul-v2.0.md](chess-overhaul-v2.0.md), where it differs from the plan, how it was verified, and what is still open. Bugs found in the review are listed in [chess-known-issues.md](chess-known-issues.md).

- **Date:** 2026-10-06
- **Branch:** `feChessReviewAndOverhaul_061026` (not committed at the time of writing)

## Outcome

`/chess/` is now a full-screen Astro app instead of a canvas page:

- a main menu
- a board built from HTML, CSS and SVG, with drag and click moves and animated pieces
- a layout that adapts to portrait and landscape screens

The rules (chess.js), the engine (`StockfishWeb.js` and `stockfish.*`) and the game flow were kept as they were. The old UI script was retired.

## Files

| Path | Role |
| --- | --- |
| `src/pages/chess.astro` | Page shell: top bar, menu and game screens, global styles (piece-set variables, board themes, buttons, segmented controls, toasts, confetti) |
| `src/layouts/GameLayout.astro` | Full-screen `<html>` shell. Reuses `BaseHead` (SEO, fonts, `global.css`) and adds the game palette (`--g-*` tokens, light and dark) |
| `src/components/chess/GameMenu.astro` | Hero, Continue tile, and the vs Robot, 2 Players and *Play a friend online* (coming soon) tiles, plus the players counter |
| `src/components/chess/ChessBoard.astro` | Board container and all board CSS: squares, highlights, coordinates, pieces, drag, face-to-face rotation |
| `src/components/chess/PlayerStrip.astro` | Player row: king icon, name, thinking dots, captured pieces, `+N` material |
| `src/components/chess/GamePanel.astro` | Status line, move history with the notation selector, action buttons (Undo, Flip, Copy PGN, Surrender, New game) |
| `src/components/chess/ChessDialogs.astro` | `<dialog>`s: promotion picker, confirm, game over, settings |
| `src/components/chess/ChessIcon.astro` | Inline stroke icons for the buttons |
| `src/scripts/chess/main.ts` | Entry point: wires screens, menu, board, panel, dialogs, settings and toasts to the controller |
| `src/scripts/chess/game.ts` | `GameController`: the port of the old `chess-game.js` flow |
| `src/scripts/chess/board-view.ts` | `BoardView`: square grid, piece layer, position diffing and animation, pointer and keyboard input |
| `src/scripts/chess/notation.ts` | History rendering in three notations; captured pieces and material |
| `src/scripts/chess/engine.ts` | Queued wrapper around the global `StockfishWeb` |
| `src/scripts/chess/stockfish-web.d.ts` | Types for the frozen `public/js/StockfishWeb.js` |
| `src/scripts/chess/effects.ts` | Web Audio sounds and confetti |
| `src/scripts/chess/prefs.ts` | localStorage: `chess_prefs` (settings) and `chess_game_state` (saved game) |
| `src/assets/chess/pieces/{cburnett,chessnut}/` | SVG piece sets from Lichess; the licenses are in the folder's `README.md` |

**Removed:** `public/js/chess-game.js`, `public/js/chess.js`, `public/js/chess.js.map` and `src/assets/screenshots/chess_boards_js.png`.

**Added:** the dependency `chess.js` `1.4.0`, pinned to that exact version.

## Key implementation decisions

- **chess.js version.** The vendored `public/js/chess.js` was compared with the npm builds of versions 1.1.0 through 1.4.0. It matches `1.4.0/dist/esm/chess.js` exactly once CRLF line endings are ignored. The rules engine is therefore unchanged and now comes with its TypeScript types.
- **Engine queue (`engine.ts`).** `StockfishWeb.send()` can resolve on another request's reply (known issue #1). All calls go through a promise queue, so only one request is ever in flight. The old unawaited warm-up search was dropped. The engine starts when a robot game starts, through `setEngineLevel`, so its first reply isn't delayed.
- **Stale robot replies.** `GameController` has a `generation` counter. New game, restore, undo and surrender all increase it, and a robot move computed for an older generation is thrown away.
- **Board rendering.**
  - Squares are 64 `<button>`s placed in the CSS grid with `grid-area`. Flipping the board recomputes the positions; the DOM order stays the same.
  - Pieces are separate elements placed with `translate: calc(var(--x) * 100%) calc(var(--y) * 100%)`.
  - `render()` compares the current pieces with the new position:
    1. Pieces that didn't move are kept.
    2. Each moved piece slides from the nearest square that had the same piece.
    3. Pieces that are gone fade out; new pieces fade in.
  - The same diff handles normal moves, castling, en passant, undo of several plies, restoring a game and flipping the board.
  - For a promotion, the move just played relabels the pawn before the diff, so the pawn slides to the last rank and turns into the new piece there.
- **No animation for full redraws.** When the whole board is replaced, the `no-anim` class is set on the board, a reflow is forced, and the class is removed on the next animation frame.
- **Input.**
  - Pointer Events on the board container handle both mouse and touch. The square under the pointer is worked out from its coordinates, so the piece layer can stay `pointer-events: none`.
  - A press becomes a drag after 4 px of movement, or 8 px on `pointer: coarse` screens.
  - A drop on a legal square snaps the piece into place; anywhere else it slides back.
  - The keyboard uses a roving tabindex: arrow keys move between squares, Enter or Space selects and moves, Esc clears the selection.
- **Piece sets.** Each set defines `--wK` … `--bP` under `[data-pieces=…]`, and `[data-piece=…]` maps one of them to `--img`. Vite turns these SVGs into inline data URIs, all except Chessnut `bQ.svg`, which is over 4 KB and is emitted as its own file. The settings previews set `data-pieces` on themselves to show a set other than the current one.
- **Top layer.** Toasts and confetti are `popover="manual"` elements, so they appear above modal dialogs. The toast popover is re-shown for each new toast so it stays on top.
- **Saved games.** The saved game keeps the old key `chess_game_state` and the old fields `{ pgn, difficulty, withRobot }`. Two optional fields were added: `humanColor` and `orientation`. A game saved by the old page restores correctly (tested).
- **Copy PGN** adds the standard header tags (Event, Site, Date, White, Black, Result) to a copy of the game, so the live game is not changed.

## Deviations from the plan

- **The menu button doesn't ask for confirmation.** The game stays in memory, and the *Continue game* tile brings it back, so nothing can be lost. The browser's Back button also returns to the menu (through `history.pushState` / `popstate`).
- **Undo against the robot** takes moves back until it is the user's turn. It never ends on the robot's turn, so "the robot moves again after undo" from the plan never happens. If the user hasn't made a move yet, it says "Nothing to undo!".
- **Toasts** name the piece in words ("Knight captured!") instead of using a glyph. This also removes old issue #6.
- **Surrender loser:** against the robot it is always the user. With two players it is still the side to move, as before. The confirmation text now depends on the mode.
- **Layout breakpoints:**
  - Landscape layout from `min-width: 34rem`. The plan said 48rem, but that left small phones held sideways with a tiny portrait layout.
  - A left icon rail replaces the top bar on short landscape screens (`max-height: 32rem`).
  - In portrait, the game is centered vertically.
- **Chess post:** the old canvas screenshot (`chess_game_js.png`) is kept in a new "The first browser version" section. Three new screenshots were added: `chess_v2_menu.png`, `chess_v2_game.png` and `chess_v2_phone.png`.
- **`/games/` tile blurb** was updated to mention 2-player games.

## Verification

- `pnpm build` (`astro check` and the build): 0 errors, 0 warnings, 0 hints.
- **Bundle:** the chess script is about 59 KB of JS, most of it chess.js. The CSS is about 61 KB, mostly the inlined piece SVGs.
- **Browser tests:** scripted with `playwright-core` driving the locally installed Chrome against `pnpm preview`. The scripts live in the session scratchpad, not in the repo. Every check below passed with no console errors or warnings:

| Area | What was checked |
| --- | --- |
| Robot game | Drag move, click-click move, the robot replies, undo, the game is saved, the Continue summary |
| Robot opens | Playing Black: the robot moves first, the board is flipped, "You" is in the bottom strip |
| Old saves | A save written by the old page (`{"pgn":"1. e4 e5","difficulty":"3","withRobot":true}`) restores |
| Promotion | Drag to the last rank opens the picker; Esc cancels and returns the pawn; click-click then Knight gives `exd8=N` |
| Fool's mate (2 players) | Check highlight, game-over dialog ("Black won!", Checkmate, 0-1), saved game cleared, Undo disabled |
| Surrender and Copy PGN | Surrender against the robot gives "The robot won", 0-1; the copied PGN has its headers |
| Keyboard | Enter on e2, ↑ ↑, Enter plays `1. e4` |
| Flip each move | The board turns to Black after White's move |
| Layout | No horizontal scroll at 390×844, 320×568 and 844×390 |

- **Static files:** `/chess.html` (redirect), `/math.html`, `/abcgame.html`, `/AbcGame/`, `/posts/chess/`, `/games/` and the `/js/stockfish*` engine files all return 200.

**Not verified automatically:**
- sound output
- real touch devices (only emulated)
- Safari and Firefox (only Chrome was used)
- stalemate and the other draw result cards (the code path is shared with checkmate)
- level 20 response time

## Follow-ups

1. Fix the open issues in [chess-known-issues.md](chess-known-issues.md) as separate tasks, mainly #4 (undo in 2-player mode takes back two plies). #2 (a failed robot move freezes the game) was fixed in v2.1, along with the other code-review findings; see [chess-review-fixes-v2.1.md](chess-review-fixes-v2.1.md). Then turn the list into GitHub issues; `gh` wasn't available.
2. Online play by link or QR code, which needs a relay server. The menu tile is already in place, disabled.
3. Test by hand on real iOS and Android devices, including sound and the safe-area insets.
4. Optional: in portrait, anchor the game near the bottom of the screen (closer to the thumbs) instead of centering it, if that feels better on a real phone.
