// Per-device settings and the saved game, kept in localStorage. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and falls back to defaults.

export type BoardTheme = 'wood' | 'green' | 'blue' | 'slate';
export type PieceSet = 'cburnett' | 'chessnut';
export type Notation = 'figurine' | 'san' | 'coords';
export type LocalOrientation = 'face' | 'flip';
export type ColorChoice = 'w' | 'b' | 'random';

export interface Prefs {
    board: BoardTheme;
    pieces: PieceSet;
    notation: Notation;
    sound: boolean;
    localOrientation: LocalOrientation;
    level: number;
    color: ColorChoice;
}

// The same key and fields as the pre-2.0 page (public/js/chess-game.js), so its saved games still restore.
// `humanColor` and `orientation` are new and optional.
export interface SavedGame {
    pgn: string;
    difficulty: number | string;
    withRobot: boolean;
    humanColor?: 'w' | 'b';
    orientation?: LocalOrientation;
}

const PREFS_KEY = 'chess_prefs';
const STORAGE_KEY = 'chess_game_state';

const defaultPrefs: Prefs = {
    board: 'wood',
    pieces: 'cburnett',
    notation: 'figurine',
    sound: false,
    localOrientation: 'face',
    level: 3,
    color: 'w',
};

const choices = {
    board: ['wood', 'green', 'blue', 'slate'],
    pieces: ['cburnett', 'chessnut'],
    notation: ['figurine', 'san', 'coords'],
    localOrientation: ['face', 'flip'],
    color: ['w', 'b', 'random'],
} as const;

function read(key: string): unknown {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function write(key: string, value: unknown) {
    try {
        if (value === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch {
        // Storage unavailable: settings simply aren't remembered.
    }
}

export function loadPrefs(): Prefs {
    const stored = (read(PREFS_KEY) ?? {}) as Partial<Record<keyof Prefs, unknown>>;
    const prefs = { ...defaultPrefs };
    for (const [key, allowed] of Object.entries(choices) as [keyof typeof choices, readonly string[]][]) {
        const value = stored[key];
        if (typeof value === 'string' && allowed.includes(value)) {
            (prefs as Record<string, unknown>)[key] = value;
        }
    }
    if (typeof stored.sound === 'boolean') prefs.sound = stored.sound;
    if (typeof stored.level === 'number') prefs.level = clampLevel(stored.level);
    return prefs;
}

export function savePrefs(prefs: Prefs) {
    write(PREFS_KEY, prefs);
}

export function clampLevel(level: unknown): number {
    return Math.min(Math.max(Math.round(Number(level)) || 0, 0), 20);
}

export function loadSavedGame(): SavedGame | null {
    const state = read(STORAGE_KEY) as SavedGame | null;
    return state && typeof state.pgn === 'string' && state.pgn ? state : null;
}

export function saveGame(state: SavedGame | null) {
    write(STORAGE_KEY, state);
}
