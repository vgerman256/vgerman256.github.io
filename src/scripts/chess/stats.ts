// The player's results on this device: wins, losses and draws against each robot level, and how many
// 2-player games were finished. Only finished games count (a game left for a new one doesn't). From the
// robot results comes a rough rating estimate.
import type { GameMode, GameResult } from './game';
import { read, write } from './prefs';

export interface Score {
    won: number;
    lost: number;
    drawn: number;
}

export interface Stats {
    robot: Record<number, Score>;
    local: number;
}

const STATS_KEY = 'chess_stats';
const MIN_RATED_GAMES = 5;

const count = (value: unknown) => (Number.isInteger(value) && (value as number) > 0 ? (value as number) : 0);
const played = (s: Score) => s.won + s.lost + s.drawn;

/** A very rough rating for a robot level: 800 at level 0 up to 2600 at level 20. */
const levelRating = (level: number) => 800 + 90 * level;

export function loadStats(): Stats {
    const stored = read(STATS_KEY) as { robot?: unknown; local?: unknown } | null;
    const stats: Stats = { robot: {}, local: count(stored?.local) };
    if (stored?.robot && typeof stored.robot === 'object') {
        for (const [key, value] of Object.entries(stored.robot as Record<string, Partial<Score> | null>)) {
            const level = Number(key);
            if (!Number.isInteger(level) || level < 0 || level > 20 || !value || typeof value !== 'object') continue;
            const score = { won: count(value.won), lost: count(value.lost), drawn: count(value.drawn) };
            if (played(score)) stats.robot[level] = score;
        }
    }
    return stats;
}

/** Adds a finished game and returns the updated stats. */
export function recordGame(mode: GameMode, result: GameResult): Stats {
    const stats = loadStats();
    if (mode.kind === 'local') {
        stats.local++;
    } else {
        const score = (stats.robot[mode.level] ??= { won: 0, lost: 0, drawn: 0 });
        if (!result.winner) score.drawn++;
        else if (result.winner === mode.humanColor) score.won++;
        else score.lost++;
    }
    write(STATS_KEY, stats);
    return stats;
}

export function resetStats() {
    write(STATS_KEY, null);
}

export const formatScore = (s: Score) => `${s.won} won · ${s.lost} lost · ${s.drawn} drawn`;

/**
 * A performance rating over all robot games, rounded to 50: the average rating of the levels played,
 * plus 400 × (wins − losses) / games. Null until there are enough games for it to mean anything.
 */
export function ratingEstimate(stats: Stats): number | null {
    let games = 0;
    let opponents = 0;
    let balance = 0;
    for (const [level, score] of Object.entries(stats.robot)) {
        games += played(score);
        opponents += played(score) * levelRating(Number(level));
        balance += score.won - score.lost;
    }
    if (games < MIN_RATED_GAMES) return null;
    return Math.round((opponents + 400 * balance) / games / 50) * 50;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

/** Fills the menu's stats card. Returns false when nothing has been played yet (the card is hidden). */
export function renderStats(body: HTMLElement, stats: Stats): boolean {
    const levels = Object.entries(stats.robot).map(([level, score]) => [Number(level), score] as const);
    const total = levels.reduce((sum, [, s]) => ({
        won: sum.won + s.won, lost: sum.lost + s.lost, drawn: sum.drawn + s.drawn,
    }), { won: 0, lost: 0, drawn: 0 });
    const robotGames = played(total);
    const nodes: HTMLElement[] = [];

    if (robotGames) {
        const tiles = el('dl', 'stat-tiles');
        const tile = (label: string, value: string) => {
            const div = el('div');
            div.append(el('dt', '', label), el('dd', '', value));
            tiles.append(div);
        };
        tile('Played', String(robotGames));
        tile('Won', String(total.won));
        tile('Lost', String(total.lost));
        tile('Drawn', String(total.drawn));
        tile('Win rate', `${Math.round((100 * total.won) / robotGames)}%`);
        nodes.push(el('h3', '', 'vs Robot'), tiles);

        const rating = ratingEstimate(stats);
        const ratingLine = el('p', 'rating');
        if (rating === null) {
            ratingLine.textContent = `Play ${MIN_RATED_GAMES - robotGames} more ${MIN_RATED_GAMES - robotGames === 1 ? 'game' : 'games'} vs the robot for a rating estimate.`;
        } else {
            ratingLine.append(el('strong', '', `≈ ${rating}`), ' rating · a rough estimate from your games vs the robot');
        }
        nodes.push(ratingLine);

        const details = el('details');
        const table = el('table');
        const head = el('tr');
        for (const label of ['Level', 'Won', 'Lost', 'Drawn']) head.append(el('th', '', label));
        table.append(el('thead'), el('tbody'));
        table.tHead!.append(head);
        for (const [level, score] of levels) {
            const row = el('tr');
            for (const value of [level, score.won, score.lost, score.drawn]) row.append(el('td', '', String(value)));
            table.tBodies[0].append(row);
        }
        details.append(el('summary', '', 'By level'), table);
        nodes.push(details);
    }

    if (stats.local) {
        nodes.push(el('p', 'local', `2-player games finished: ${stats.local}`));
    }

    body.replaceChildren(...nodes);
    return robotGames + stats.local > 0;
}
