// The optional chess clock (specs/chess-clock-v2.4.md): time controls, the countdown, and the times saved
// with a game. Only clocked colors count down: both in a 2-player game, the human alone against the robot.
import type { Color } from 'chess.js';

export const timeControls = ['off', '3+2', '5+3', '10+5', '15+10'] as const;
export type TimeControl = (typeof timeControls)[number];

export interface SavedClock {
    control: TimeControl;
    left: { w?: number; b?: number };
    marks?: (number | null)[];
}

const LOW_TIME_MS = 20_000;

export const isTimeControl = (value: unknown): value is TimeControl =>
    typeof value === 'string' && (timeControls as readonly string[]).includes(value);

/** Base time and increment in milliseconds, or null for no clock. */
function parseTimeControl(control: TimeControl): { base: number; increment: number } | null {
    if (control === 'off') return null;
    const [minutes, seconds] = control.split('+').map(Number);
    return { base: minutes * 60_000, increment: seconds * 1000 };
}

/** The PGN TimeControl tag: base and increment in seconds, e.g. "300+3". */
export function pgnTimeControl(control: TimeControl): string {
    const parsed = parseTimeControl(control);
    return parsed ? `${parsed.base / 1000}+${parsed.increment / 1000}` : '-';
}

export const isLowTime = (ms: number) => ms < LOW_TIME_MS;

const pad = (n: number) => String(n).padStart(2, '0');

/** "4:07", or "0:09.4" under 20 seconds. */
export function formatClock(ms: number): string {
    const t = Math.max(0, ms);
    if (isLowTime(t)) {
        const tenths = Math.floor(t / 100);
        return `0:${pad(Math.floor(tenths / 10))}.${tenths % 10}`;
    }
    const s = Math.floor(t / 1000);
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** H:MM:SS, as in a PGN [%clk] comment. */
export function formatPgnClock(ms: number): string {
    const s = Math.floor(Math.max(0, ms) / 1000);
    return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

const validTime = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const plyColor = (index: number): Color => (index % 2 === 0 ? 'w' : 'b');

export class ChessClock {
    control: TimeControl = 'off';
    paused = false;
    // The mover's time left after each ply (index 0 is ply 1), null for a move by an unclocked color.
    marks: (number | null)[] = [];
    private base = 0;
    private increment = 0;
    private left: Record<Color, number> = { w: 0, b: 0 };
    private clocked: Record<Color, boolean> = { w: false, b: false };
    private running: Color | null = null;
    private since = 0;
    private flagTimer = 0;

    constructor(private onFlag: (color: Color) => void) {}

    get enabled(): boolean {
        return this.control !== 'off';
    }

    get runningColor(): Color | null {
        return this.running;
    }

    isClocked(color: Color): boolean {
        return this.enabled && this.clocked[color];
    }

    /** A new clock for a game that has `plies` moves, optionally with the times of a saved game. */
    reset(control: TimeControl, clocked: Color[], plies: number, saved?: SavedClock) {
        this.stop();
        const parsed = parseTimeControl(control);
        this.control = control;
        this.paused = false;
        this.base = parsed?.base ?? 0;
        this.increment = parsed?.increment ?? 0;
        this.clocked = { w: clocked.includes('w'), b: clocked.includes('b') };
        this.left = { w: validTime(saved?.left?.w) ?? this.base, b: validTime(saved?.left?.b) ?? this.base };
        this.marks = Array.isArray(saved?.marks) && saved.marks.length === plies
            ? saved.marks.map(validTime)
            : Array(plies).fill(null);
    }

    timeLeft(color: Color): number {
        const elapsed = this.running === color ? performance.now() - this.since : 0;
        return Math.max(0, this.left[color] - elapsed);
    }

    /** The time `color` had with `ply` moves played (for review): its clock after its last move up to then. */
    timeAt(color: Color, ply: number): number {
        for (let i = Math.min(ply, this.marks.length) - 1; i >= 0; i--) {
            const mark = this.marks[i];
            if (plyColor(i) === color && mark !== null) return mark;
        }
        return this.base;
    }

    /**
     * Lets `color`'s clock run, or none for null. A paused clock and an unclocked color don't run.
     * Calling it again for the color that is already running changes nothing.
     */
    run(color: Color | null) {
        const next = color && this.isClocked(color) && !this.paused ? color : null;
        if (next === this.running) return;
        this.stop();
        if (next) {
            this.running = next;
            this.since = performance.now();
            this.flagTimer = window.setTimeout(() => this.checkFlag(next), this.left[next]);
        }
    }

    /** Charges `color` for the move just played (ply number `ply`) and adds the increment, except to White's first move. */
    moved(color: Color, ply: number) {
        if (this.running === color) this.stop();
        if (this.isClocked(color) && ply > 1) this.left[color] += this.increment;
        this.marks.length = ply - 1;
        this.marks.push(this.isClocked(color) ? this.left[color] : null);
    }

    /** Moves were taken back: forget their clock marks. The time spent stays spent. */
    truncate(plies: number) {
        this.marks.length = Math.min(this.marks.length, plies);
    }

    save(): SavedClock | undefined {
        if (!this.enabled) return undefined;
        return { control: this.control, left: { w: this.timeLeft('w'), b: this.timeLeft('b') }, marks: [...this.marks] };
    }

    private stop() {
        if (this.running) {
            this.left[this.running] = this.timeLeft(this.running);
            this.running = null;
        }
        clearTimeout(this.flagTimer);
    }

    private checkFlag(color: Color) {
        const left = this.timeLeft(color);
        if (left > 0) {
            this.flagTimer = window.setTimeout(() => this.checkFlag(color), left);
            return;
        }
        this.stop();
        this.onFlag(color);
    }
}
