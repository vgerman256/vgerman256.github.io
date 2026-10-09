// Game flow, ported from the pre-2.0 public/js/chess-game.js (doMove, handleGameState, undoMove,
// surrenderGame, saveGameState/loadSavedGame). The rules stay in chess.js. Behavior is kept as it was,
// apart from what new features need (the robot can play White). Known bugs that were deliberately
// left alone are listed in specs/chess-known-issues.md.
import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';
import { ChessClock, formatPgnClock, isTimeControl, pgnTimeControl, type SavedClock, type TimeControl } from './clock';
import { getBestMove, setEngineLevel } from './engine';
import { clampLevel, saveGame, type LocalOrientation, type SavedGame } from './prefs';

export type GameMode =
    | { kind: 'robot'; level: number; humanColor: Color; clock: TimeControl }
    | { kind: 'local'; orientation: LocalOrientation; clock: TimeControl };

export interface GameResult {
    result: '1-0' | '0-1' | '1/2-1/2';
    winner: Color | null;
    reason: string;
}

export interface GameEvents {
    /**
     * The position changed: `move` was just played, or (move = null) moves were taken back or a game was
     * started or restored. `animate` is false when the whole board is replaced at once.
     */
    position(move: Move | null, animate: boolean): void;
    thinking(on: boolean): void;
    notify(text: string): void;
    over(result: GameResult): void;
}

const pieceNames: Record<PieceSymbol, string> = {
    p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King',
};

export const colorName = (color: Color) => (color === 'w' ? 'White' : 'Black');

/** The mode a saved game was played in. Fields missing from older saves get the pre-2.0 defaults. */
export function modeFromSaved(state: SavedGame): GameMode {
    const clock = isTimeControl(state.clock?.control) ? state.clock.control : 'off';
    return state.withRobot !== false
        ? { kind: 'robot', level: clampLevel(state.difficulty ?? 1), humanColor: state.humanColor ?? 'w', clock }
        : { kind: 'local', orientation: state.orientation ?? 'face', clock };
}
const opponent = (color: Color): Color => (color === 'w' ? 'b' : 'w');

/** Whether `color` has only a king, or a king and a single bishop or knight: too little to ever checkmate. */
function cannotMate(game: Chess, color: Color): boolean {
    const pieces = game.board().flat().filter((p) => p && p.color === color && p.type !== 'k');
    return pieces.length === 0 || (pieces.length === 1 && (pieces[0]!.type === 'b' || pieces[0]!.type === 'n'));
}

export class GameController {
    game = new Chess();
    mode: GameMode = { kind: 'local', orientation: 'face', clock: 'off' };
    clock = new ChessClock((color) => this.timeOut(color));
    result: GameResult | null = null;
    thinking = false;
    // Set when the robot failed to produce a move; the UI then offers retryRobot().
    robotFailed = false;
    // Bumped whenever the game is replaced or taken back, so a robot reply computed for an older
    // position is dropped instead of being played into the new one.
    private generation = 0;
    // Bumped on every change to the position. chess.js replays the whole game for each
    // history({ verbose: true }) call, so history() keeps the result until the next change.
    private version = 0;
    private historyVersion = -1;
    private historyCache: Move[] = [];

    constructor(private events: GameEvents) {}

    isRobotTurn(): boolean {
        return this.mode.kind === 'robot' && this.game.turn() !== this.mode.humanColor;
    }

    /** The robot failed to move and is waiting for the user to ask it again. */
    needsRetry(): boolean {
        return this.robotFailed && !this.thinking && !this.result && this.isRobotTurn();
    }

    retryRobot() {
        if (this.needsRetry()) void this.robotTurnIfNeeded();
    }

    /** The color the user may move right now, or null while the robot thinks, the clock is paused or the game is over. */
    movableColor(): Color | null {
        return this.result || this.thinking || this.isPaused() || this.isRobotTurn() ? null : this.game.turn();
    }

    /** The game is paused by the user, a hidden page or a visit to the menu. */
    isPaused(): boolean {
        return this.clock.paused && !this.result;
    }

    /** Pauses the clock of a game in progress and saves its times. */
    pauseClock() {
        if (!this.clock.enabled || this.result || !this.hasMoves() || this.clock.paused) return;
        this.clock.paused = true;
        this.syncClock();
        this.saveGameState();
    }

    resumeClock() {
        if (!this.isPaused()) return;
        this.clock.paused = false;
        this.syncClock();
    }

    /** The moves played so far (cached; don't modify the array). */
    history(): Move[] {
        if (this.historyVersion !== this.version) {
            this.historyCache = this.game.history({ verbose: true });
            this.historyVersion = this.version;
        }
        return this.historyCache;
    }

    /** Plies played, counted without replaying the game (every game starts from the initial position). */
    plyCount(): number {
        return (this.game.moveNumber() - 1) * 2 + (this.game.turn() === 'b' ? 1 : 0);
    }

    hasMoves(): boolean {
        return this.plyCount() > 0;
    }

    playerName(color: Color): string {
        if (this.mode.kind === 'local') return colorName(color);
        return color === this.mode.humanColor ? 'You' : `Stockfish · level ${this.mode.level}`;
    }

    canUndo(): boolean {
        if (this.result || this.thinking) return false;
        // Against the robot there must be a move of the user's own: their first is ply 1 as White, ply 2 as Black.
        const mode = this.mode;
        return this.plyCount() >= (mode.kind === 'robot' && mode.humanColor === 'b' ? 2 : 1);
    }

    async start(mode: GameMode) {
        this.reset(mode, new Chess());
        saveGame(null);
        this.events.position(null, false);
        this.events.notify(mode.kind === 'robot' && mode.humanColor === 'b'
            ? 'New game started, the robot moves first!'
            : 'New game started, white moves first!');
        await this.robotTurnIfNeeded();
    }

    restore(state: SavedGame): boolean {
        try {
            const game = new Chess();
            game.loadPgn(state.pgn);
            if (game.isGameOver()) {
                saveGame(null);
                return false;
            }

            this.reset(modeFromSaved(state), game, state.clock);
            // A clock that was running comes back paused, so no time is lost before the player is ready.
            this.clock.paused = this.clock.enabled && this.hasMoves();
            this.syncClock();
            this.events.position(null, false);
            this.events.notify('Game restored!');
            void this.robotTurnIfNeeded();
            return true;
        } catch {
            saveGame(null);
            return false;
        }
    }

    /** Plays a legal move chosen by the user (promotion already resolved), then lets the robot reply. */
    async doMove(move: Move) {
        // The game can end while a move is being chosen (time out with the promotion picker open).
        if (this.result) return;
        try {
            const moveResult = this.game.move(move);
            this.version++;
            this.clocked(moveResult);
            this.events.position(moveResult, true);

            const canMove = this.handleGameState(moveResult);
            this.saveGameState();
            if (canMove) {
                await this.robotTurnIfNeeded();
            }
        } catch (error) {
            console.warn(`Bad move: ${move.from} ${move.to}`, error);
        }
    }

    undo() {
        const mode = this.mode;
        if (!this.canUndo()) {
            this.events.notify('Nothing to undo!');
            return;
        }

        this.generation++;
        if (mode.kind === 'robot') {
            // Take back the robot's reply (if any) and the user's move before it, back to the user's turn.
            let undone: Move | null;
            do {
                undone = this.game.undo();
            } while (undone && undone.color !== mode.humanColor);
        } else {
            // As before: two plies, i.e. both players' last moves (specs/chess-known-issues.md #4).
            this.game.undo();
            this.game.undo();
        }

        this.version++;
        this.clock.truncate(this.plyCount());
        this.syncClock();
        this.events.position(null, true);
        this.saveGameState();
    }

    surrender() {
        if (this.result) return;
        const loser: Color = this.mode.kind === 'robot' ? this.mode.humanColor : this.game.turn();
        const msg = `${colorName(loser)} surrendered`;

        this.generation++;
        this.setThinking(false);
        this.events.notify(`${msg}!`);
        this.finish({ result: loser === 'w' ? '0-1' : '1-0', winner: opponent(loser), reason: msg });
    }

    /** PGN with the standard header tags (and clock times, if any), for copying to other chess tools. */
    pgn(): string {
        const copy = new Chess();
        this.history().forEach((move, i) => {
            copy.move(move.san);
            const mark = this.clock.marks[i];
            if (mark != null) copy.setComment(`[%clk ${formatPgnClock(mark)}]`);
        });
        const now = new Date();
        const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        copy.setHeader('Event', this.mode.kind === 'robot' ? 'Game vs Stockfish' : 'Casual game');
        copy.setHeader('Site', 'https://vgerman256.github.io/chess/');
        copy.setHeader('Date', date);
        copy.setHeader('White', this.playerName('w'));
        copy.setHeader('Black', this.playerName('b'));
        copy.setHeader('Result', this.result?.result ?? '*');
        if (this.clock.enabled) copy.setHeader('TimeControl', pgnTimeControl(this.clock.control));
        return copy.pgn();
    }

    private reset(mode: GameMode, game: Chess, savedClock?: SavedClock) {
        this.generation++;
        this.mode = mode;
        this.game = game;
        this.version++;
        this.result = null;
        this.robotFailed = false;
        this.setThinking(false);
        this.clock.reset(mode.clock, mode.kind === 'robot' ? [mode.humanColor] : ['w', 'b'], this.plyCount(), savedClock);
        if (mode.kind === 'robot') {
            // Also starts the engine early, so its first reply isn't delayed by loading the worker.
            setEngineLevel(mode.level).catch((error) => console.warn('Stockfish failed to start', error));
        }
    }

    private async robotTurnIfNeeded() {
        if (this.result || !this.isRobotTurn()) return;

        const generation = this.generation;
        this.robotFailed = false;
        this.setThinking(true);
        try {
            const computerMove = await getBestMove(this.game.fen());
            if (generation !== this.generation) return;
            if (!computerMove) throw new Error('Stockfish returned no move');

            const computerMoveResult = this.game.move(computerMove);
            this.version++;
            this.clocked(computerMoveResult);
            this.events.position(computerMoveResult, true);
            this.handleGameState(computerMoveResult);
            this.saveGameState();
        } catch (error) {
            // The robot's turn stays open; the panel offers Retry (specs/chess-known-issues.md #2).
            console.warn('Robot move failed', error);
            if (generation === this.generation) {
                this.robotFailed = true;
                this.events.notify('The robot could not move. Press Retry.');
            }
        } finally {
            if (generation === this.generation) this.setThinking(false);
        }
    }

    private handleGameState(move: Move): boolean {
        const nextTurnWhite = this.game.turn() === 'w';
        const prevColor = nextTurnWhite ? 'Black' : 'White';
        const nextColor = nextTurnWhite ? 'White' : 'Black';

        if (move.captured) {
            this.events.notify(`${pieceNames[move.captured]} captured!`);
        }
        if (move.promotion) {
            this.events.notify(`${pieceNames[move.promotion]} promotion!`);
        }

        if (this.game.isGameOver()) {
            if (this.game.isDraw()) {
                this.events.notify('Draw!');
                this.finish({ result: '1/2-1/2', winner: null, reason: this.drawReason() });
            } else {
                this.events.notify(`${prevColor} won!`);
                this.finish({ result: nextTurnWhite ? '0-1' : '1-0', winner: opponent(this.game.turn()), reason: 'Checkmate' });
            }
            return false;
        }

        if (this.game.isCheck()) {
            this.events.notify(`Check to ${nextColor}!`);
        }
        return true;
    }

    private drawReason(): string {
        if (this.game.isStalemate()) return 'Stalemate';
        if (this.game.isThreefoldRepetition()) return 'Threefold repetition';
        if (this.game.isInsufficientMaterial()) return 'Insufficient material';
        return 'Fifty-move rule';
    }

    private finish(result: GameResult) {
        this.result = result;
        this.syncClock();
        saveGame(null);
        this.events.over(result);
    }

    /** Records a move on the clock and starts the next player's clock. */
    private clocked(move: Move) {
        this.clock.moved(move.color, this.plyCount());
        this.syncClock();
    }

    /** No clock runs before White's first move or after the game; otherwise the side to move's clock does. */
    private syncClock() {
        this.clock.run(this.result || !this.hasMoves() ? null : this.game.turn());
    }

    private timeOut(color: Color) {
        if (this.result) return;
        const winner = opponent(color);
        const msg = `${colorName(color)} ran out of time`;

        this.generation++;
        this.setThinking(false);
        if (cannotMate(this.game, winner)) {
            this.events.notify('Draw!');
            this.finish({ result: '1/2-1/2', winner: null, reason: `${msg}, but ${colorName(winner)} can't checkmate` });
        } else {
            this.events.notify(`${msg}!`);
            this.finish({ result: winner === 'w' ? '1-0' : '0-1', winner, reason: msg });
        }
    }

    private saveGameState() {
        if (this.result) return;
        const mode = this.mode;
        saveGame({
            pgn: this.game.pgn(),
            difficulty: mode.kind === 'robot' ? mode.level : 1,
            withRobot: mode.kind === 'robot',
            ...(mode.kind === 'robot' ? { humanColor: mode.humanColor } : { orientation: mode.orientation }),
            clock: this.clock.save(),
        });
    }

    private setThinking(on: boolean) {
        if (this.thinking === on) return;
        this.thinking = on;
        this.events.thinking(on);
    }
}
