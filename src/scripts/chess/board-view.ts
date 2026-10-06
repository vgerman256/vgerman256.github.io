// The board: 64 square <button>s in a CSS grid plus a layer of piece elements on top of it. Pieces keep
// their element across moves, so moving one only changes its --x/--y and a CSS transition animates it.
// Mouse and touch both go through Pointer Events (drag, or click a piece then a target), and the
// keyboard through the square buttons (arrow keys + Enter/Space).
import type { Chess, Color, Move, PieceSymbol, Square } from 'chess.js';

export type PieceCode = `${Color}${Uppercase<PieceSymbol>}`;

export interface BoardOptions {
    /** The color the user may move now, or null when the board is locked. */
    movableColor(): Color | null;
    legalMoves(from: Square): Move[];
    choosePromotion(color: Color, to: Square): Promise<PieceSymbol | null>;
    onMove(move: Move): void;
}

interface DragState {
    from: Square;
    el: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    deselectOnUp: boolean;
}

const FILES = 'abcdefgh';
const pieceNames: Record<string, string> = {
    P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king',
};

export const pieceCode = (color: Color, type: PieceSymbol) => `${color}${type.toUpperCase()}` as PieceCode;

export class BoardView {
    private squares = new Map<Square, HTMLButtonElement>();
    private pieces = new Map<Square, HTMLElement>();
    private squaresLayer: HTMLElement;
    private piecesLayer: HTMLElement;
    private orientation: Color = 'w';
    private selected: Square | null = null;
    private targets: Move[] = [];
    private lastMove: Move | undefined;
    private checkSquare: Square | null = null;
    private focusSquare: Square = 'e2';
    private drag: DragState | null = null;
    private dragOver: Square | null = null;
    private dragThreshold = matchMedia('(pointer: coarse)').matches ? 8 : 4;

    constructor(private root: HTMLElement, private opts: BoardOptions) {
        this.squaresLayer = root.querySelector('.squares')!;
        this.piecesLayer = root.querySelector('.pieces')!;

        for (let rank = 8; rank >= 1; rank--) {
            for (const file of FILES) {
                const square = `${file}${rank}` as Square;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `sq ${(FILES.indexOf(file) + rank) % 2 ? 'dark' : 'light'}`;
                button.dataset.square = square;
                button.tabIndex = -1;
                button.innerHTML = '<span class="coord coord-rank"></span><span class="coord coord-file"></span>';
                this.squares.set(square, button);
                this.squaresLayer.append(button);
            }
        }
        this.layoutSquares();
        this.setFocusSquare(this.focusSquare, false);

        root.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        root.addEventListener('pointermove', (e) => this.onPointerMove(e));
        root.addEventListener('pointerup', (e) => this.onPointerUp(e));
        root.addEventListener('pointercancel', () => this.cancelDrag());
        root.addEventListener('contextmenu', (e) => e.preventDefault());
        this.squaresLayer.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    get flipped(): boolean {
        return this.orientation === 'b';
    }

    setOrientation(color: Color) {
        if (color === this.orientation) return;
        this.orientation = color;
        this.layoutSquares();
        for (const [square, el] of this.pieces) this.place(el, square);
    }

    setFaceToFace(on: boolean) {
        this.root.classList.toggle('face-to-face', on);
    }

    /**
     * Shows the position of `game`. With `animate`, pieces glide to their new squares, captured pieces
     * fade out and new ones fade in. `move` is the move just played, if any; for a promotion it lets the
     * pawn slide to the last rank and turn into the new piece there.
     */
    render(game: Chess, { move, animate }: { move?: Move | null; animate: boolean }) {
        this.cancelDrag();
        this.root.classList.toggle('no-anim', !animate);

        const target = new Map<Square, PieceCode>();
        for (const row of game.board()) {
            for (const piece of row) {
                if (piece) target.set(piece.square, pieceCode(piece.color, piece.type));
            }
        }

        if (move?.promotion) {
            const pawn = this.pieces.get(move.from);
            if (pawn) pawn.dataset.piece = pieceCode(move.color, move.promotion);
        }

        // Keep pieces that didn't move, slide each moved piece from the nearest square with the same
        // piece, then fade out whatever is left over (captures) and fade in anything new.
        const next = new Map<Square, HTMLElement>();
        const leftovers: [Square, HTMLElement][] = [];
        for (const [square, el] of this.pieces) {
            if (target.get(square) === el.dataset.piece) next.set(square, el);
            else leftovers.push([square, el]);
        }
        for (const [square, code] of target) {
            if (next.has(square)) continue;
            let best = -1;
            let bestDistance = Infinity;
            leftovers.forEach(([from, el], i) => {
                if (el.dataset.piece !== code) return;
                const d = distance(from, square);
                if (d < bestDistance) [best, bestDistance] = [i, d];
            });
            if (best >= 0) {
                const [[, el]] = leftovers.splice(best, 1);
                this.place(el, square);
                next.set(square, el);
            } else {
                next.set(square, this.createPiece(code, square, animate));
            }
        }
        for (const [, el] of leftovers) {
            if (animate) {
                el.classList.add('leaving');
                setTimeout(() => el.remove(), 250);
            } else {
                el.remove();
            }
        }
        this.pieces = next;

        if (!animate) {
            void this.root.offsetWidth;
            requestAnimationFrame(() => this.root.classList.remove('no-anim'));
        }

        this.lastMove = game.history({ verbose: true }).at(-1);
        this.checkSquare = game.isCheck() ? game.findPiece({ type: 'k', color: game.turn() })[0] ?? null : null;
        this.clearSelection();
        this.refresh();
    }

    /** Re-reads whose turn it is (e.g. when the robot starts or stops thinking). */
    refresh() {
        const color = this.opts.movableColor();
        if (!color || (this.selected && this.pieces.get(this.selected)?.dataset.piece?.[0] !== color)) {
            this.cancelDrag();
            this.clearSelection();
        }
        this.root.classList.toggle('locked', !color);
    }

    squareRect(square: Square): DOMRect {
        return this.squares.get(square)!.getBoundingClientRect();
    }

    /** Whether `square` is drawn on the top row of the board as currently oriented. */
    isTopRow(square: Square): boolean {
        return this.toDisplay(square)[1] === 0;
    }

    private createPiece(code: PieceCode, square: Square, animate: boolean): HTMLElement {
        const el = document.createElement('div');
        el.className = animate ? 'piece appear' : 'piece';
        el.dataset.piece = code;
        this.place(el, square);
        this.piecesLayer.append(el);
        return el;
    }

    private place(el: HTMLElement, square: Square) {
        const [x, y] = this.toDisplay(square);
        el.dataset.square = square;
        el.style.setProperty('--x', String(x));
        el.style.setProperty('--y', String(y));
    }

    private toDisplay(square: Square): [number, number] {
        const file = FILES.indexOf(square[0]);
        const rank = Number(square[1]) - 1;
        return this.orientation === 'w' ? [file, 7 - rank] : [7 - file, rank];
    }

    private fromDisplay(col: number, row: number): Square {
        const file = this.orientation === 'w' ? col : 7 - col;
        const rank = this.orientation === 'w' ? 7 - row : row;
        return `${FILES[file]}${rank + 1}` as Square;
    }

    private squareAt(clientX: number, clientY: number): Square | null {
        const rect = this.squaresLayer.getBoundingClientRect();
        const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
        const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
        return col >= 0 && col < 8 && row >= 0 && row < 8 ? this.fromDisplay(col, row) : null;
    }

    private layoutSquares() {
        for (const [square, button] of this.squares) {
            const [col, row] = this.toDisplay(square);
            button.style.gridArea = `${row + 1} / ${col + 1}`;
            button.querySelector('.coord-rank')!.textContent = col === 0 ? square[1] : '';
            button.querySelector('.coord-file')!.textContent = row === 7 ? square[0] : '';
        }
    }

    private ownPieceAt(square: Square): boolean {
        const color = this.opts.movableColor();
        return !!color && this.pieces.get(square)?.dataset.piece?.[0] === color;
    }

    private isTarget(square: Square): boolean {
        return this.targets.some((m) => m.to === square);
    }

    private select(square: Square) {
        this.selected = square;
        this.targets = this.opts.legalMoves(square);
        this.updateSquares();
    }

    private clearSelection() {
        this.selected = null;
        this.targets = [];
        this.updateSquares();
    }

    /** Click semantics shared by pointer and keyboard: select, re-select, deselect, or move. */
    private activate(square: Square) {
        if (this.selected && this.isTarget(square)) {
            void this.tryMove(this.selected, square);
        } else if (this.ownPieceAt(square) && this.selected !== square) {
            this.select(square);
        } else {
            this.clearSelection();
        }
    }

    private async tryMove(from: Square, to: Square) {
        const candidates = this.targets.filter((m) => m.from === from && m.to === to);
        const el = this.pieces.get(from);
        this.clearSelection();
        if (!candidates.length) return;

        let move = candidates[0];
        if (move.promotion) {
            const piece = await this.opts.choosePromotion(move.color, to);
            const chosen = piece && candidates.find((m) => m.promotion === piece);
            if (!chosen) {
                if (el) this.place(el, from);
                return;
            }
            move = chosen;
        }
        this.opts.onMove(move);
    }

    private onPointerDown(e: PointerEvent) {
        if (e.button !== 0 || this.drag) return;
        const square = this.squareAt(e.clientX, e.clientY);
        if (!square) return;
        this.setFocusSquare(square, false);

        if (this.selected && this.isTarget(square)) {
            e.preventDefault();
            void this.tryMove(this.selected, square);
            return;
        }
        if (!this.ownPieceAt(square)) {
            this.clearSelection();
            return;
        }

        e.preventDefault();
        const deselectOnUp = this.selected === square;
        if (!deselectOnUp) this.select(square);
        this.drag = {
            from: square,
            el: this.pieces.get(square)!,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            active: false,
            deselectOnUp,
        };
        this.root.setPointerCapture(e.pointerId);
    }

    private onPointerMove(e: PointerEvent) {
        const drag = this.drag;
        if (!drag || drag.pointerId !== e.pointerId) return;
        if (!drag.active) {
            if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < this.dragThreshold) return;
            drag.active = true;
            drag.el.classList.add('dragging');
        }

        const rect = this.squaresLayer.getBoundingClientRect();
        const half = rect.width / 16;
        drag.el.style.translate = `${e.clientX - rect.left - half}px ${e.clientY - rect.top - half}px`;

        const over = this.squareAt(e.clientX, e.clientY);
        if (over !== this.dragOver) {
            if (this.dragOver) this.squares.get(this.dragOver)!.classList.remove('drag-over');
            if (over) this.squares.get(over)!.classList.add('drag-over');
            this.dragOver = over;
        }
    }

    private onPointerUp(e: PointerEvent) {
        const drag = this.drag;
        if (!drag || drag.pointerId !== e.pointerId) return;
        this.endDrag();

        if (!drag.active) {
            if (drag.deselectOnUp) this.clearSelection();
            return;
        }

        const square = this.squareAt(e.clientX, e.clientY);
        if (square && square !== drag.from && this.isTarget(square)) {
            // Drop: the piece lands where it was released instead of sliding there again.
            drag.el.classList.add('snap');
            drag.el.style.translate = '';
            this.place(drag.el, square);
            void drag.el.offsetWidth;
            drag.el.classList.remove('snap');
            void this.tryMove(drag.from, square);
        } else {
            // Dropped off a legal square: the piece slides back, and stays selected.
            drag.el.style.translate = '';
        }
    }

    private cancelDrag() {
        if (!this.drag) return;
        this.drag.el.style.translate = '';
        this.endDrag();
    }

    private endDrag() {
        const drag = this.drag;
        if (!drag) return;
        this.drag = null;
        drag.el.classList.remove('dragging');
        if (this.root.hasPointerCapture(drag.pointerId)) this.root.releasePointerCapture(drag.pointerId);
        if (this.dragOver) this.squares.get(this.dragOver)!.classList.remove('drag-over');
        this.dragOver = null;
    }

    private onKeyDown(e: KeyboardEvent) {
        const [col, row] = this.toDisplay(this.focusSquare);
        const step: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
        };
        if (step[e.key]) {
            e.preventDefault();
            const [dx, dy] = step[e.key];
            const nextCol = Math.min(Math.max(col + dx, 0), 7);
            const nextRow = Math.min(Math.max(row + dy, 0), 7);
            this.setFocusSquare(this.fromDisplay(nextCol, nextRow), true);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.activate(this.focusSquare);
        } else if (e.key === 'Escape') {
            this.clearSelection();
        }
    }

    private setFocusSquare(square: Square, focus: boolean) {
        this.squares.get(this.focusSquare)!.tabIndex = -1;
        this.focusSquare = square;
        const button = this.squares.get(square)!;
        button.tabIndex = 0;
        if (focus) button.focus();
    }

    private updateSquares() {
        const lastFrom = this.lastMove?.from;
        const lastTo = this.lastMove?.to;
        for (const [square, button] of this.squares) {
            const target = this.targets.find((m) => m.to === square);
            button.classList.toggle('last-move', square === lastFrom || square === lastTo);
            button.classList.toggle('selected', square === this.selected);
            button.classList.toggle('check', square === this.checkSquare);
            button.classList.toggle('target', !!target);
            button.classList.toggle('capture', !!target?.captured);

            const code = this.pieces.get(square)?.dataset.piece;
            let label = code ? `${square}, ${code[0] === 'w' ? 'white' : 'black'} ${pieceNames[code[1]]}` : `${square}, empty`;
            if (square === this.selected) label += ', selected';
            else if (target) label += ', legal move';
            button.setAttribute('aria-label', label);
        }
    }
}

function distance(a: Square, b: Square): number {
    return Math.hypot(FILES.indexOf(a[0]) - FILES.indexOf(b[0]), Number(a[1]) - Number(b[1]));
}
