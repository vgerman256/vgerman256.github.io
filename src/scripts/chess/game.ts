// Game flow, ported from the pre-2.0 public/js/chess-game.js (doMove, handleGameState, undoMove,
// surrenderGame, saveGameState/loadSavedGame). The rules stay in chess.js. Behavior is kept as it was,
// apart from what new features need (the robot can play White). Known bugs that were deliberately
// left alone are listed in specs/chess-known-issues.md.
import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';
import { getBestMove, setEngineLevel } from './engine';
import { clampLevel, saveGame, type LocalOrientation, type SavedGame } from './prefs';

export type GameMode =
    | { kind: 'robot'; level: number; humanColor: Color }
    | { kind: 'local'; orientation: LocalOrientation };

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
const opponent = (color: Color): Color => (color === 'w' ? 'b' : 'w');

export class GameController {
    game = new Chess();
    mode: GameMode = { kind: 'local', orientation: 'face' };
    result: GameResult | null = null;
    thinking = false;
    // Bumped whenever the game is replaced or taken back, so a robot reply computed for an older
    // position is dropped instead of being played into the new one.
    private generation = 0;

    constructor(private events: GameEvents) {}

    isRobotTurn(): boolean {
        return this.mode.kind === 'robot' && this.game.turn() !== this.mode.humanColor;
    }

    /** The color the user may move right now, or null while the robot thinks or the game is over. */
    movableColor(): Color | null {
        return this.result || this.thinking || this.isRobotTurn() ? null : this.game.turn();
    }

    lastMove(): Move | undefined {
        return this.game.history({ verbose: true }).at(-1);
    }

    playerName(color: Color): string {
        if (this.mode.kind === 'local') return colorName(color);
        return color === this.mode.humanColor ? 'You' : `Stockfish · level ${this.mode.level}`;
    }

    canUndo(): boolean {
        if (this.result || this.thinking) return false;
        const history = this.game.history({ verbose: true });
        const mode = this.mode;
        return mode.kind === 'robot' ? history.some((m) => m.color === mode.humanColor) : history.length > 0;
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

            this.reset(state.withRobot !== false
                ? { kind: 'robot', level: clampLevel(state.difficulty ?? 1), humanColor: state.humanColor ?? 'w' }
                : { kind: 'local', orientation: state.orientation ?? 'face' }, game);
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
        try {
            const moveResult = this.game.move(move);
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
        if (this.result || this.thinking) return;

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

    /** PGN with the standard header tags, for copying to other chess tools. */
    pgn(): string {
        const copy = new Chess();
        copy.loadPgn(this.game.pgn());
        const now = new Date();
        const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        copy.setHeader('Event', this.mode.kind === 'robot' ? 'Game vs Stockfish' : 'Casual game');
        copy.setHeader('Site', 'https://vgerman256.github.io/chess/');
        copy.setHeader('Date', date);
        copy.setHeader('White', this.playerName('w'));
        copy.setHeader('Black', this.playerName('b'));
        copy.setHeader('Result', this.result?.result ?? '*');
        return copy.pgn();
    }

    private reset(mode: GameMode, game: Chess) {
        this.generation++;
        this.mode = mode;
        this.game = game;
        this.result = null;
        this.setThinking(false);
        if (mode.kind === 'robot') {
            // Also starts the engine early, so its first reply isn't delayed by loading the worker.
            setEngineLevel(mode.level).catch((error) => console.warn('Stockfish failed to start', error));
        }
    }

    private async robotTurnIfNeeded() {
        if (this.result || !this.isRobotTurn()) return;

        const generation = this.generation;
        this.setThinking(true);
        try {
            const computerMove = await getBestMove(this.game.fen());
            if (generation !== this.generation) return;

            const computerMoveResult = this.game.move(computerMove as string);
            this.events.position(computerMoveResult, true);
            this.handleGameState(computerMoveResult);
            this.saveGameState();
        } catch (error) {
            // Left as before: the game waits on the robot's turn (specs/chess-known-issues.md #2).
            console.warn('Robot move failed', error);
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
        saveGame(null);
        this.events.over(result);
    }

    private saveGameState() {
        if (this.result) return;
        const mode = this.mode;
        saveGame({
            pgn: this.game.pgn(),
            difficulty: mode.kind === 'robot' ? mode.level : 1,
            withRobot: mode.kind === 'robot',
            ...(mode.kind === 'robot' ? { humanColor: mode.humanColor } : { orientation: mode.orientation }),
        });
    }

    private setThinking(on: boolean) {
        if (this.thinking === on) return;
        this.thinking = on;
        this.events.thinking(on);
    }
}
