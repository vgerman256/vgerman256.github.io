# Chess v2.2: post-game review and player statistics

## Context

When a chess game ends, the "View board" button on the game-over card just closes the card, and the board shows only the final position. The user wants to step back and forward through the finished game: buttons everywhere, swipe left/right on phones, and convenient controls on other devices. They also want simple statistics: games played, robot results by level, and a rough rating hint.

Decisions made with the user:

- Review is available **only after the game ends**. During a game the board stays live, so the robot's turn, Undo and "Flip each move" are not affected.
- Stats count robot wins, losses and draws **per level**. 2-player games only add to a "games played" total. Surrender counts as a loss. A game you abandon (New game, Menu) is **not** counted.
- The rating hint is a **rough performance rating** computed from the counts. It is shown after 5 or more robot games.

First step of the implementation: copy this plan to `specs/chess-review-and-stats-v2.2.md`, as CLAUDE.md requires. Each part below gets its own commit, after `pnpm build` and a browser check.

## Part 1: step through a finished game

### State (`src/scripts/chess/main.ts`, new "Review" section)

- `viewPly: number | null` holds the ply on screen. `null` means the live position. It is reset to `null` in `onPosition()`, so it resets on every move, undo, new game and restore.
- `isReviewing()` returns `!!controller.result`. Review needs no "enter" step: once the game is over, the controls work.
- `showPly(ply)`:
  1. Clamps `ply` to `0..moves.length`.
  2. Builds the position with `new Chess(ply ? moves[ply - 1].after : DEFAULT_POSITION)`. chess.js 1.4.0 verbose moves carry `before`/`after` FENs, so nothing is replayed.
  3. Calls `board.render(viewGame, { move, animate: true, lastMove: moves[ply - 1] })`. `move` is the stepped move only on a single step forward, so a promotion animates. Backward steps and jumps pass `null`, and `render()` already fades pieces out and in.
  4. Plays the move or capture sound on a single forward step.
  5. Calls `updatePanel()`.
- The board stays locked in review: `movableColor()` already returns `null` when `controller.result` is set. Orientation is left as it was at the end of the game.

### Panel changes

- **`fillStrip()` / `updatePanel()`** take the viewed position and `moves.slice(0, ply)`, so captured pieces and the material balance match the board. Today they use `controller.game`.
- **Status row** (`GamePanel.astro`): the status text gets nav buttons on both sides: `⏮ ◀ [status] ▶ ⏭`. They are `hidden` unless the game is over, and disabled at either end.
  - At the last ply, the status keeps today's result text ("Checkmate · 0-1").
  - Elsewhere it shows the viewed move, e.g. "12… Qh4#", or "Start position" at ply 0.
  - Portrait has no spare height (the board budget subtracts 9.5rem for the panel). So the row always reserves the button height (about 2.5rem), and the portrait `--board-size` budget in `chess.astro` grows to match. The board then does not jump when the game ends.
- **`renderHistory()`** (`notation.ts`) gets a `current` ply argument instead of always highlighting the last move. Each `.ply` gets `data-ply`. The list scrolls the current ply into view inside itself, not the page.
  - In review, a click on a ply jumps there. A delegated click listener on `#history` is active only while reviewing, and plies get `cursor: pointer`.
- **New icons** in `ChessIcon.astro`: `first`, `prev`, `next` and `last` chevrons, in the same 24×24 stroke style.

### Input methods

- **Phones and tablets: swipe on the board.**
  - `pointerdown`/`pointerup` listeners on `#board` in main.ts, active only while reviewing.
  - A swipe counts when |dx| ≥ 40px and |dx| > 1.5·|dy|. Swipe left shows the next move, swipe right the previous one, like turning pages.
  - The board already has `touch-action: none`, so the browser doesn't scroll or go back on a swipe.
  - BoardView ignores these presses: the board is locked, so `onPointerDown` just clears the selection.
- **Keyboard:** a document `keydown` listener, active while reviewing on the game screen. ←/→ step one move, Home/End jump to the start/end.
  - It skips events from `select`/`input` and from open dialogs.
  - It listens in the capture phase, ahead of the board's own arrow-key handling. Once the game is over no piece can move, so ←/→ step through the game even when a square has focus (a click on the board focuses one). ↑/↓ still move square focus.
- **Mouse/desktop:** the nav buttons and clicking a move in the history list.
- **Game-over card:** "View board" closes the card as today. Focus then goes to the ◀ button, so keyboard users land on the controls.

## Part 2: statistics

### Storage

- `prefs.ts` exports its guarded `read`/`write` helpers so the new module can reuse them.
- **New `src/scripts/chess/stats.ts`:**
  - Key: `chess_stats`.
  - Shape: `{ robot: { [level]: { won, lost, drawn } }, local: number }`.
  - `loadStats()` validates the data: levels 0–20 and non-negative integers only. Anything else falls back to empty stats.
  - `recordGame(mode, result)` updates the counts and saves them.
  - `ratingEstimate(stats)` returns `null` under 5 robot games.
    - Each level gets an approximate rating: `800 + 90 × level`, which runs from 800 at level 0 to 2600 at level 20. These values line up with the menu's level bands (Beginner … Master).
    - The estimate is the average opponent rating plus 400 × (W − L) / N, clamped to ±400 around that average and rounded to the nearest 50.
  - `renderStats(el, stats)` builds the card's DOM, the same way `notation.ts` builds the history.

### Where results are recorded

- In `onGameOver()` in main.ts, which already works out `humanWon` per mode. It calls `recordGame(controller.mode, result)`.
- `GameController.finish()` runs only once per game, and a finished game is never restored, so nothing is counted twice. Abandoned games never reach `finish()`, so they are not counted.
- `game.ts` is unchanged.

### Display

- **Menu (`GameMenu.astro`):** a "Your stats" card below the tiles. It is hidden when nothing has been played yet. It shows:
  - Robot games: played · won · lost · drawn, and the win rate.
  - The rating hint, "≈ 1350 · rough estimate". With fewer than 5 robot games: "Play 5 games vs the robot for a rating estimate".
  - A `<details>` "By level" table, listing only the levels played.
  - The 2-player games played.
  - "Reset stats" behind the existing `confirmAction()` dialog.
- **The card is refreshed** in `showScreen('menu')` and after each recorded game.
- **Game-over card:** robot games get one extra line, e.g. "Level 5: 3 won · 2 lost · 1 drawn".

## Files

- `src/scripts/chess/main.ts`: review state, `showPly`, swipe/keyboard/history-click wiring, `fillStrip`/`updatePanel` take the viewed position, stats recording and refresh.
- `src/scripts/chess/notation.ts`: `renderHistory(list, moves, notation, current, result?)`, `data-ply`, scroll the current ply into view.
- `src/scripts/chess/stats.ts` (new): storage, recording, rating estimate, rendering.
- `src/scripts/chess/prefs.ts`: export `read`/`write`.
- `src/components/chess/GamePanel.astro`: status row with nav buttons, clickable plies in review.
- `src/components/chess/GameMenu.astro`: stats card markup and styles.
- `src/components/chess/ChessDialogs.astro`: the stats line on the game-over card.
- `src/components/chess/ChessIcon.astro`: the four nav icons.
- `src/pages/chess.astro`: the portrait board-size budget.
- `CLAUDE.md`: add `stats` to the `scripts/chess/` list and the v2.2 spec to `specs/`.
- `specs/chess-review-and-stats-v2.2.md` (new): this plan, plus a short "Result" section when done.
- **Not touched:** `game.ts`, `engine.ts`, `board-view.ts`, all frozen `public/` files.

## Verification

1. **`pnpm build`:** `astro check` has no strict-mode errors, and the build succeeds.
2. **`pnpm preview` + headless Chrome**, as in v2.1, at desktop size and with phone emulation (portrait):
   - **Fool's mate in 2-player mode** (f3 e5 g4 Qh4#), then "View board":
     - ◀ steps back with the pieces animating, and the captured pieces and check highlight follow the board.
     - ⏮/⏭ jump to the ends, and the buttons are disabled at the ends.
     - ←/→/Home/End work.
     - Clicking "2. g4" in the history jumps there.
   - **Swipe:** dispatch touch pointer events on the board (CDP `Input.dispatchTouchEvent`). A left swipe goes forward and a right swipe back. A mostly vertical swipe does nothing.
   - **During a live game:** the nav buttons are hidden and the arrow keys still move square focus. After New game the board shows the live position.
   - **Promotion:** play a game that ends after a promotion, then step backward and forward over it. The pawn turns into the piece.
   - **Portrait:** the board size does not change when the game ends, and nothing scrolls.
3. **Stats:**
   - Surrender vs level 3 → the menu card shows 1 lost at level 3, and the game-over card shows the level line.
   - The fool's mate game → 2-player count 1.
   - Start a robot game, make a move, press New game → nothing is counted.
   - Seed `chess_stats` with 6 games → a rating appears. Corrupt JSON → the card falls back to empty, with no errors.
   - Reset stats asks first, then clears the card.
4. **Frozen pages:** `/math.html`, `/abcgame.html` and `/chess.html` (redirect) still load.
