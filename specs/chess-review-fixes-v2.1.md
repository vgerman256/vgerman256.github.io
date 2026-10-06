# Chess v2.1: fixes from the code review of the 2.0 overhaul

This plan fixes the 10 findings from the code review of the uncommitted [chess 2.0 overhaul](chess-overhaul-v2.0.md). The work is split into 5 stages of 2 fixes each.

**After each stage:**
1. Run `pnpm build`.
2. Check the UI in the browser (headless Chrome against `pnpm preview`) whenever the stage touches the UI.
3. Commit the stage on its own.

**Baseline:** the 2.0 overhaul is committed first, before any fix, so each stage commit contains only its own fixes.

## Stage 1: engine failures (findings 1 and 7)

- **1. A Stockfish worker that never answers blocks the engine queue forever.**
  - `engine.ts` gives `init()` a time limit and listens for the worker's `error` event. Each move search also gets a time limit.
  - On any failure the worker is terminated and the engine reset, so the next request starts a fresh one.
- **7. A failed robot move is silent and, when the human plays Black, can't be undone.**
  - `GameController` records the failure (`robotFailed`) and shows a message.
  - The panel shows a *Retry* button that asks the robot again. This also closes known issue #2.

## Stage 2: dialogs (findings 2 and 3)

- **2. A click in a dialog's padding counts as a click outside it.** Closing on a click outside now compares the click position with the dialog's on-screen rectangle.
- **3. The 700 ms game-over timer is never cancelled.** The timer is cleared when a new game starts or the game is restored, and it checks that the same game is still on screen before opening the dialog.

## Stage 3: game modes (findings 4 and 9)

- **4. Play again and New game rebuild the mode from the menu settings.** Both now repeat the current game's mode: the same level and color against the robot, the same board setting for two players.
- **9. The conversion from a saved game to a game mode exists twice.** It moves into one shared `modeFromSaved()` used by both the Continue tile and `restore()`.

## Stage 4: board and strip styling (findings 5 and 6)

- **5. Flip in "Face to face" mode leaves the bottom player's pieces upside down.** The rotation now applies to whichever color is at the top of the board, not always to Black.
- **6. The color circle's styles tie in specificity with the global `.pc` rule.** The circle's selector is made more specific, so its background color and icon size always win.

## Stage 5: performance and cleanup (findings 8 and 10)

- **8. The full move history is replayed many times per update.** Verbose history is computed once per update and passed to `render()`, `canUndo()` and the panel. A cheap `hasMoves()` replaces `history().length` checks.
- **10. Dead code and a duplicated check.** `lastMove()` is removed, along with the guard in `undo()` that repeats `canUndo()`.

## Result

All five stages were done on 2026-10-06, each in its own commit after `pnpm build` and a browser check:

- **Stage 1:** a silent Stockfish worker now fails after 20 s; Retry starts a new worker and reapplies the level.
- **Stage 2:** clicks in a dialog's padding and drags out of the card leave it open; no stale game-over card after New game or Menu.
- **Stage 3:** New game and Play again repeat the current game's level and color.
- **Stage 4:** after Flip in "Face to face", the top player's pieces are the upside-down ones; the color circle has its background back.
- **Stage 5:** the history cache follows every move, undo and reset, including a different line at the same ply count.

The earlier smoke and scenario suites were rerun after the last stage and still pass.
