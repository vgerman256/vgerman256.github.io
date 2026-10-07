// Move history in three notations, plus each player's captured pieces and material advantage.
import type { Chess, Color, Move, PieceSymbol } from 'chess.js';
import { pieceCode } from './board-view';
import type { Notation } from './prefs';

const pieceValues: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function figurine(color: Color, type: string): HTMLElement {
    const span = document.createElement('span');
    span.className = 'pc fig';
    span.dataset.piece = pieceCode(color, type.toLowerCase() as PieceSymbol);
    return span;
}

/** A move as DOM nodes: SAN with piece icons (figurine), plain SAN, or the old from–to coordinates. */
export function formatMove(move: Move, notation: Notation): (Node | string)[] {
    if (notation === 'san') return [move.san];

    if (notation === 'coords') {
        const check = move.san.match(/[+#]$/)?.[0] ?? '';
        const parts: (Node | string)[] = [
            figurine(move.color, move.piece),
            `${move.from}${move.captured ? '×' : '–'}${move.to}`,
        ];
        if (move.promotion) parts.push('=', figurine(move.color, move.promotion));
        if (check) parts.push(check);
        return parts;
    }

    // Figurine algebraic notation: the piece letter (and a promotion letter) drawn as the piece itself.
    const match = move.san.match(/^([KQRBN])?(.*?)(?:=([QRBN]))?([+#]?)$/);
    if (!match || move.san.startsWith('O-O')) return [move.san];
    const [, piece, body, promotion, check] = match;
    const parts: (Node | string)[] = [];
    if (piece) parts.push(figurine(move.color, piece));
    parts.push(body);
    if (promotion) parts.push('=', figurine(move.color, promotion));
    if (check) parts.push(check);
    return parts;
}

// What each list last drew. A review step only changes `current`, so the moves aren't rebuilt for it.
// GameController.history() returns a new array after every change, so comparing the array is enough.
const drawn = new WeakMap<HTMLElement, { moves: Move[]; notation: Notation; result?: string }>();

/**
 * The move list. `current` is the number of plies on the board (the move with that number is
 * highlighted); each ply carries data-ply, the ply count after it, for jumping there in review.
 */
export function renderHistory(list: HTMLElement, moves: Move[], notation: Notation, current: number, result?: string) {
    const last = drawn.get(list);
    if (!last || last.moves !== moves || last.notation !== notation || last.result !== result) {
        list.replaceChildren(...historyItems(moves, notation, result));
        drawn.set(list, { moves, notation, result });
    }

    list.querySelector('.ply.current')?.classList.remove('current');
    const currentEl = list.querySelector<HTMLElement>(`.ply[data-ply="${current}"]`);
    currentEl?.classList.add('current');

    if (current >= moves.length) {
        // The live (or final) position: show the latest moves and the result.
        list.scrollTop = list.scrollHeight;
        list.scrollLeft = list.scrollWidth;
    } else if (!currentEl) {
        // The start position (review at ply 0).
        list.scrollTop = 0;
        list.scrollLeft = 0;
    } else {
        scrollIntoList(list, currentEl);
    }
}

function historyItems(moves: Move[], notation: Notation, result?: string): HTMLElement[] {
    const items: HTMLElement[] = [];
    for (let i = 0; i < moves.length; i += 2) {
        const li = document.createElement('li');
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = `${i / 2 + 1}.`;
        li.append(num);
        moves.slice(i, i + 2).forEach((move, j) => {
            const ply = document.createElement('span');
            ply.className = 'ply';
            ply.dataset.ply = String(i + j + 1);
            ply.setAttribute('aria-label', move.san);
            ply.append(...formatMove(move, notation));
            li.append(ply);
        });
        items.push(li);
    }

    if (result) {
        const li = document.createElement('li');
        li.className = 'result';
        li.textContent = result;
        items.push(li);
    }
    return items;
}

/** Scrolls the list (only the list, never the page) just enough to show `el`. */
function scrollIntoList(list: HTMLElement, el: HTMLElement) {
    const box = list.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < box.top) list.scrollTop += r.top - box.top;
    else if (r.bottom > box.bottom) list.scrollTop += r.bottom - box.bottom;
    if (r.left < box.left) list.scrollLeft += r.left - box.left - 8;
    else if (r.right > box.right) list.scrollLeft += r.right - box.right + 8;
}

/** The pieces `color` has captured, most valuable first, and "+N" when `color` is ahead in material. */
export function renderCaptured(el: HTMLElement, moves: Move[], color: Color, game: Chess) {
    const captured = moves
        .filter((m) => m.color === color && m.captured)
        .map((m) => m.captured!)
        .sort((a, b) => pieceValues[b] - pieceValues[a]);
    const other: Color = color === 'w' ? 'b' : 'w';

    let material = 0;
    for (const row of game.board()) {
        for (const piece of row) {
            if (piece) material += pieceValues[piece.type] * (piece.color === color ? 1 : -1);
        }
    }

    const nodes: HTMLElement[] = captured.map((type) => figurine(other, type));
    if (material > 0) {
        const adv = document.createElement('span');
        adv.className = 'adv';
        adv.textContent = `+${material}`;
        nodes.push(adv);
    }
    el.replaceChildren(...nodes);
}
