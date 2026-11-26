# Chess v2.5: 2-player undo and the promotion picker on touch

Two bug fixes, done together in one branch (`fix/chess-undo-and-promotion`).

## 1. Undo in a 2-player game takes back one move

Known issue #4 in [chess-known-issues.md](chess-known-issues.md).

- **Bug:** in a 2-player game, Undo took back two plies: both players' last moves.
- **Fix:** in `GameController.undo()` (`src/scripts/chess/game.ts`), a 2-player game undoes exactly one ply.
- **Unchanged:** against the robot, Undo still takes back the robot's reply and the user's move, back to the user's turn.
- `canUndo()` already allows Undo from one ply in 2-player games. The clock is truncated to the new ply count, as before. In *Flip each move*, the board turns back to the player whose move was taken back.

## 2. The promotion picker closes at once on touch, promoting to a queen

- **Bug:** tapping a pawn and then tapping its promotion square promoted straight to a queen, without showing the picker. This happened in both modes, but it shows up mostly in 2-player games, which are played on phones and tablets. Mouse clicks and drags were not affected.
- **Cause:**
  - The board makes a click-to-move on `pointerdown`, so the picker opens while the finger is still down.
  - The picker is docked over the promotion square, with the Queen button on that square.
  - A tap fires its `click` at the element under the finger when it is lifted. That is the Queen button, so the picker submits "q" at once.
- **Fix:** in `src/scripts/chess/main.ts`, the picker accepts a pointer click only if the press also started inside the picker. Otherwise the click's default action (submitting the form) is cancelled. Keyboard activation (`click` with `detail === 0`) is accepted as before. Esc and a click outside the picker still cancel it.
- **Check:** the fix is verified in headless Chromium by tapping a7 then b8 (touch), clicking (mouse), and dragging, in both modes. In each case the picker stays open, and choosing a piece then promotes to that piece.
