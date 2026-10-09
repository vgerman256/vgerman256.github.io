# Chess v2.4: optional chess clock

Both game modes get an optional clock. Off is the default, so games without a clock work exactly as before.

## Menu

- **Clock row.** Both menu tiles (Play vs Robot, 2 Players) get a "Clock" button row, styled like *Play as* and *Board*: **Off · 3+2 · 5+3 · 10+5 · 15+10**.
  - "5+3" means 5 minutes each, plus 3 seconds added after every move.
  - A short muted caption explains the choice:
    - Robot tile: "Minutes + seconds per move. Only your clock runs."
    - 2-player tile: "Minutes each + seconds added per move."
- **Remembered choice.** Each tile remembers its own choice in `chess_prefs` (`robotClock`, `localClock`; default `off`).
- **Continue tile.** It shows the time control, e.g. "vs Robot · level 3 · you play White · 5+3 · move 12".

## In the game

- **The clock pill.** Each clocked player's strip ends with a clock showing the time left.
  - Monospace digits. The clock keeps its size, and the captured pieces shrink first.
  - **Running:** accent colour, the same accent as the ring that marks whose turn it is.
  - **Waiting:** dim.
  - **Under 20 seconds:** red, with tenths shown (`0:09.4`). While running it pulses gently.
  - **Under 10 seconds:** if sound is on, a soft tick every second while it runs.
- **Robot mode.** Only the human's clock runs. The robot's strip has no clock, because its thinking time is set inside the frozen `StockfishWeb.js`.
- **Face to face.** The top strip is already turned 180°, so its clock reads the right way up for the player across the table.

## Rules

| Topic | Behaviour |
|---|---|
| Start | No clock runs before White's first move. After it, the clock of the side to move runs. |
| Increment | Added to the mover's time after each of their moves, except White's first, which is free. |
| Time out | The player whose time runs out loses ("White ran out of time"). If the other side has only a king, or a king plus one bishop or knight, it's a draw instead. Counted in stats like any other result. |
| Pause | Tap a clock to pause. A blurred overlay covers the board: "Paused · tap to resume". Tapping the overlay or a clock resumes. The game also pauses by itself when the page is hidden (tab switch, phone locked) or the player goes back to the menu. |
| While paused | The board doesn't accept moves. In robot mode, the robot still finishes a reply it is already thinking about. |
| Undo | Allowed. It doesn't give time back. |
| Saved game | The time control, the times left and each move's clock time are saved with the game, including when it pauses. A restored game with a running clock starts paused. Older saves restore without a clock. |
| Robot can't move (Retry) | Nothing runs, because only the human's clock exists and it's the robot's turn. |
| Promotion dialog open at time out | The dialog closes and the move is dropped. |

## After the game

- **Review.** Each clock shows the time it had at the reviewed move. With the final position shown, it shows the final times.
- **Copy PGN** adds two things, in the standard format that other chess sites read:
  - a `TimeControl` header, e.g. `300+3`;
  - a `[%clk 0:04:52]` comment after each clocked move.

## Implementation

- **`src/scripts/chess/clock.ts` (new):**
  - Time controls and parsing, plus the `ChessClock` class.
  - The class keeps the time left per color, which colors are clocked, and the mover's clock after each ply (`marks`).
  - It tracks the running color and the pause flag, and schedules a timer for the moment the running clock reaches zero.
  - It also formats times for the UI and the PGN, and holds the saved-state type.
- **`src/scripts/chess/game.ts`:**
  - `GameMode` gains `clock: TimeControl`, and `GameController` owns a `ChessClock`.
  - After every move, undo, start, restore and finish, one `syncClock()` decides whose clock runs.
  - A time out finishes the game through the existing `finish()`.
  - `doMove` ignores moves once the game is over.
  - `pauseClock()` / `resumeClock()` for the UI. The save includes the clock.
  - `pgn()` adds the clock tags.
- **`src/scripts/chess/prefs.ts`:** `robotClock` / `localClock` prefs, and an optional `clock` field in `SavedGame`.
- **`src/components/chess/PlayerStrip.astro`:** the clock button and its styles.
- **`src/components/chess/GameMenu.astro`:** the Clock rows and captions.
- **`src/pages/chess.astro`:** the pause overlay over the board.
- **`src/scripts/chess/main.ts`:**
  - Menu wiring and clock rendering: a 100 ms interval that writes only changed text.
  - Clock times in review.
  - Pause on tap, on a hidden page and on going back to the menu. Resume from the overlay.
  - Closing the promotion dialog at game over.
- **`src/scripts/chess/effects.ts`:** a `tick` sound.
- **`CLAUDE.md`:** add `clock` to the `scripts/chess/` list and this spec to `specs/`.
- **Not touched:** `engine.ts`, `board-view.ts`, `stats.ts`, all frozen `public/` files.

## Check

1. Run `pnpm build`, which includes `astro check`.
2. Run headless Chrome against `pnpm preview`:
   - **Menu:** the Clock rows fit on a phone-width tile without wrapping.
   - **2 players at 3+2:** no clock runs before 1. e4. After it, Black's clock runs and +2 s is added after Black's move.
   - **Time out:** with a seeded save where a clock is almost out, the game ends with "White ran out of time". Also check the draw case with a lone king.
   - **Pause:** tapping a clock shows the overlay and stops the time. A hidden page pauses. Resume continues the countdown.
   - **Robot mode:** only the human's strip has a clock, and it doesn't run while the robot thinks.
   - **Restore:** a saved game with a clock comes back paused with its times. An old save without a clock still restores.
   - **PGN:** has `TimeControl` and `%clk`.
   - **Review:** the clocks follow the reviewed move.
   - **Layout:** portrait phone and landscape phone (the small 1.9rem strip).

## Result

Done on 2026-10-09. `pnpm build` (with `astro check`) passes. I ran 32 checks in headless Chrome against `pnpm preview` at 390×844 and 844×390, in dark and light mode, and all passed.

**Menu**
- The Clock rows fit on one line at phone width.
- The Continue summary shows the time control.
- Each tile remembers its own choice (`robotClock`, `localClock`).

**2 players at 3+2**
- No clock runs before 1. e4. After it, Black's clock runs.
- White gets no increment for move 1. Black gets +2 s.

**Pause**
- Tapping a clock shows the blurred overlay, freezes the times, locks the board and sets the status to "Paused". The overlay resumes the game.
- A hidden page pauses and saves the times. So does going to the menu, and Continue comes back paused.

**Time out and review**
- A seeded save with 1.5 s left restores paused and shows `0:01.5` in red. After resume the game ends with "White ran out of time", 0-1.
- The save is cleared and the game is counted in stats.
- Review shows each move's clock times.

**Saves, PGN and robot**
- An old save without a clock restores with no clock and no pause.
- Copy PGN has `[TimeControl "180+2"]` and `{[%clk 0:03:00]}` comments.
- At 3+2 vs the robot, only the human has a clock. At level 20 it stayed idle for the whole time the robot was thinking (50 samples).

**Not covered in the browser:** the draw on time when the other side can't checkmate. A seeded game can only start from the initial position, so that ending can't be reached quickly. The rule is in `cannotMate()` in `game.ts`.

**One build gotcha:** the CSS minifier merged `backdrop-filter` with `-webkit-backdrop-filter` and kept only the prefixed one, which Chrome ignores. The overlay therefore uses only the unprefixed property, like the dialogs do.
