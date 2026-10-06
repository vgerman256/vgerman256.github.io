# Chess: known issues from the 2.0 review

These issues were found while reviewing the pre-2.0 chess code (`public/js/chess-game.js` and `public/js/StockfishWeb.js`) for [chess-overhaul-v2.0](chess-overhaul-v2.0.md). That overhaul deliberately left the game logic alone. Each issue below is to be fixed as a separate task.

The **Status** line says where each issue stands after the 2.0 rewrite (`src/scripts/chess/`):

- **Open:** the issue is still present.
- **Avoided:** the new UI never triggers it, but the root cause is still there.
- **Gone:** the code that had it was retired.

## 1. Concurrent engine requests resolve each other

`StockfishWeb.send()` resolves on the first worker line that contains the awaited token (`bestmove`, `readyok`). Two calls in flight at the same time can therefore resolve each other.

The old page fired an unawaited warm-up search `getBestMove('e2e4', 1000)` right after init. If the user moved within about a second, the robot could be handed the warm-up's answer: a move for a different position. That move is illegal, so `doMove`'s `catch` swallowed it and the game hung on the robot's turn.

- **Status:** avoided.
  - `src/scripts/chess/engine.ts` queues every engine call, so only one is ever in flight.
  - The warm-up search was dropped.
  - Since v2.1, every engine call also has a time limit and fails on a worker `error` event. A worker that never answers no longer blocks the queue forever: it is terminated, and the next call starts a new one.
  - `StockfishWeb.send()` itself is unchanged.
- **Fix idea:** keep one pending request at a time inside `StockfishWeb` itself, or match each reply to the request that caused it.

## 2. A failed robot move freezes the game silently

The old `doMove` swallowed every error in a `catch`. That includes a `null`/`(none)` `bestmove` and an engine failure. The game then stays on the robot's turn with no message.

- **Status:** fixed in v2.1.
  - A failed robot move (engine error, time-out or no move returned) shows "The robot could not move" and a *Retry the robot's move* button (`GameController.needsRetry()` / `retryRobot()`).
  - Retry works even when the user has no move to undo, for example as Black before the robot's first move.

## 3. Input accepted while the robot thinks

On the old canvas board you could select and move Black's pieces, or press Undo, while Stockfish was searching. The robot's reply was then played into a different position.

- **Status:** avoided. The new board is locked whenever it isn't a human's turn, and Undo is disabled while the robot thinks.

## 4. Undo in a 2-player game takes back two moves

`undoMove` always undoes two plies. Against the robot that is right: it takes back your move and the robot's reply. With two players it also takes back the previous player's move.

- **Status:** open. `GameController.undo()` keeps the two-ply behavior for 2-player games.
- **Fix idea:** in 2-player mode, undo one ply.

## 5. Undo with fewer than two moves leaves the screen out of date

With only one ply in the history, the old `undoMove` undid it, then hit "Nothing to undo!" on the second iteration and returned early. It never refreshed the move history or saved the game.

- **Status:** gone. The new UI redraws everything from the game state after every undo. Against the robot, undo now always stops on the user's turn.

## 6. Capture and promotion toasts always showed a white piece

`pieceToUtf8Image.get(move.captured)` looked up the lowercase key, which is the white glyph, whatever the piece's color.

- **Status:** gone. Toasts now use piece names ("Knight captured!").

## 7. `console.log` disabled for the whole page

`chess-game.js` replaced `console.log` with a no-op unless `?debug` was in the URL. This also silenced every other script on the page.

- **Status:** gone, together with `chess-game.js`.

## 8. Surrender wording and loser in 2-player games

The surrender dialog said "Surrender to the robot?" even in 2-player games, and the loser was always the side to move.

- **Status:** partly fixed.
  - The dialog text now depends on the mode.
  - Against the robot, the loser is now always the user.
  - In 2-player games it is still the side to move: there is no way to tell which player pressed the button.

## 9. The promotion picker couldn't be cancelled

The old promotion modal had no way out. The game was stuck until a piece was chosen.

- **Status:** gone. Esc or a click outside the picker cancels it and returns the pawn.

## 10. Minor

- The "Draw! No winers..." typo. **Status:** gone.
- The players counter image still counts hits for the old `chess.html` URL. **Status:** open, kept on purpose so the count continues.
