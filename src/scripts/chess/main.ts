// Entry point: wires the menu, the board, the side panel, the dialogs and the settings to the GameController.
import { Chess, DEFAULT_POSITION, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { BoardView } from './board-view';
import { confetti, playSound, setSoundEnabled } from './effects';
import { GameController, colorName, modeFromSaved, type GameMode, type GameResult } from './game';
import { formatMove, renderCaptured, renderHistory } from './notation';
import { clampLevel, loadPrefs, loadSavedGame, savePrefs, type Prefs } from './prefs';
import { formatScore, loadStats, recordGame, renderStats, resetStats } from './stats';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const app = $('chess-app');
const prefs = loadPrefs();

const controller = new GameController({
    position: onPosition,
    thinking: () => {
        board.refresh();
        updatePanel();
    },
    notify: showNotification,
    over: onGameOver,
});

const board = new BoardView($('board'), {
    movableColor: () => controller.movableColor(),
    legalMoves: (from) => controller.game.moves({ square: from, verbose: true }),
    choosePromotion,
    onMove: (move) => void controller.doMove(move),
});

// ---- Screens -------------------------------------------------------------------------------------

type Screen = 'menu' | 'game';

function showScreen(screen: Screen) {
    const apply = () => {
        app.dataset.screen = screen;
        updateContinue();
        if (screen === 'menu') updateStats();
        // The move list can only scroll to the latest move while it is visible.
        if (screen === 'game') updatePanel();
    };
    if (app.dataset.screen === screen) return apply();
    if (document.startViewTransition) document.startViewTransition(apply);
    else apply();
}

function enterGame() {
    if (history.state?.screen !== 'game') history.pushState({ screen: 'game' }, '');
    showScreen('game');
}

// The browser's back button (or the menu button) leaves the game for the menu; the game stays in memory.
window.addEventListener('popstate', () => {
    showScreen(history.state?.screen === 'game' && hasGameInMemory() ? 'game' : 'menu');
});

$('menu-btn').addEventListener('click', () => {
    if (history.state?.screen === 'game') history.back();
    else showScreen('menu');
});

function hasGameInMemory(): boolean {
    return !controller.result && controller.hasMoves();
}

// ---- Menu ----------------------------------------------------------------------------------------

const levelInput = $<HTMLInputElement>('level-input');
const levelBands = ['Beginner', 'Casual', 'Club player', 'Strong', 'Master'];

function updateLevelLabel() {
    const level = clampLevel(levelInput.value);
    $('level-output').textContent = String(level);
    $('level-band').textContent = levelBands[Math.min(Math.floor(level / 4), 4)];
}

levelInput.value = String(prefs.level);
updateLevelLabel();
levelInput.addEventListener('input', updateLevelLabel);
setRadio('color', prefs.color);
setRadio('menu-orientation', prefs.localOrientation);

function setRadio(name: string, value: string) {
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
}

function getRadio(name: string): string {
    return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '';
}

function modeFromPrefs(kind: GameMode['kind']): GameMode {
    if (kind === 'local') return { kind, orientation: prefs.localOrientation };
    const humanColor: Color = prefs.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : prefs.color;
    return { kind, level: prefs.level, humanColor };
}

function startGame(mode: GameMode) {
    clearTimeout(overTimer);
    enterGame();
    void controller.start(mode);
}

$('start-robot').addEventListener('click', () => {
    prefs.level = clampLevel(levelInput.value);
    prefs.color = getRadio('color') as Prefs['color'];
    savePrefs(prefs);
    startGame(modeFromPrefs('robot'));
});

$('start-local').addEventListener('click', () => {
    prefs.localOrientation = getRadio('menu-orientation') as Prefs['localOrientation'];
    savePrefs(prefs);
    syncSettingsForm();
    startGame(modeFromPrefs('local'));
});

const continueTile = $('continue-tile');

function describeMode(mode: GameMode): string {
    return mode.kind === 'robot'
        ? `vs Robot · level ${mode.level} · you play ${colorName(mode.humanColor)}`
        : '2 players on this device';
}

function updateContinue() {
    let summary = '';
    if (hasGameInMemory()) {
        summary = `${describeMode(controller.mode)} · move ${controller.game.moveNumber()}`;
    } else {
        const saved = loadSavedGame();
        if (saved) {
            try {
                const game = new Chess();
                game.loadPgn(saved.pgn);
                if (!game.isGameOver()) summary = `${describeMode(modeFromSaved(saved))} · move ${game.moveNumber()}`;
            } catch {
                // Unreadable save: no Continue tile; the controller clears it if it is ever restored.
            }
        }
    }
    continueTile.hidden = !summary;
    $('continue-summary').textContent = summary;
}

function updateStats() {
    $('stats-card').hidden = !renderStats($('stats-body'), loadStats());
}

$('stats-reset').addEventListener('click', async () => {
    if (await confirmAction('Reset your chess stats on this device?', 'Reset')) {
        resetStats();
        updateStats();
    }
});

continueTile.addEventListener('click', () => {
    if (hasGameInMemory()) {
        enterGame();
        return;
    }
    const saved = loadSavedGame();
    clearTimeout(overTimer);
    if (saved && controller.restore(saved)) {
        enterGame();
    } else {
        updateContinue();
    }
});

// ---- Board and panel -----------------------------------------------------------------------------

const stripTop = $('strip-top');
const stripBottom = $('strip-bottom');
const historyList = $('history');
const statusLine = $('status');
const statusRow = $('status-row');
const reviewFirst = $<HTMLButtonElement>('review-first');
const reviewPrev = $<HTMLButtonElement>('review-prev');
const reviewNext = $<HTMLButtonElement>('review-next');
const reviewLast = $<HTMLButtonElement>('review-last');
const undoButton = $<HTMLButtonElement>('undo-btn');
const pgnButton = $<HTMLButtonElement>('pgn-btn');
const surrenderButton = $<HTMLButtonElement>('surrender-btn');
const retryButton = $<HTMLButtonElement>('retry-btn');

let flipTimer = 0;

/** Orientation and piece rotation for the current mode. */
function applyModeView() {
    const mode = controller.mode;
    const faceToFace = mode.kind === 'local' && mode.orientation === 'face';
    board.setFaceToFace(faceToFace);
    stripTop.classList.toggle('rotated', faceToFace);
    board.setOrientation(mode.kind === 'robot'
        ? mode.humanColor
        : mode.orientation === 'flip' ? controller.game.turn() : 'w');
}

function onPosition(move: Move | null, animate: boolean) {
    clearTimeout(flipTimer);
    viewPly = null;
    overPending = false;
    if (!animate) applyModeView();
    board.render(controller.game, { move, animate, lastMove: controller.history().at(-1) });

    const mode = controller.mode;
    if (animate && mode.kind === 'local' && mode.orientation === 'flip') {
        // Let the move finish before turning the board to the next player.
        flipTimer = window.setTimeout(() => {
            board.setOrientation(controller.game.turn());
            updatePanel();
        }, 450);
    }

    if (move && !controller.game.isGameOver()) {
        playSound(controller.game.isCheck() ? 'check' : move.captured ? 'capture' : 'move');
    }
    updatePanel();
}

/** Fills a player strip for `game`, the position on the board, after `moves` (the moves up to it). */
function fillStrip(strip: HTMLElement, color: Color, moves: Move[], game: Chess) {
    strip.querySelector<HTMLElement>('.player-color')!.dataset.piece = `${color}K`;
    strip.querySelector('.player-name')!.textContent = controller.playerName(color);
    strip.querySelector<HTMLElement>('.thinking')!.hidden = !(controller.thinking && game.turn() === color);
    strip.classList.toggle('to-move', !controller.result && game.turn() === color);
    renderCaptured(strip.querySelector('.captured')!, moves, color, game);
}

const WORD_JOINER = String.fromCharCode(0x2060);

/** The status line while reviewing: the shown move in the chosen notation, or the start position. */
function reviewStatus(ply: number): (Node | string)[] {
    const move = controller.history()[ply - 1];
    if (!move) return ['Start position'];
    // The figurine icons have no text, so screen readers get the move as plain SAN instead.
    const shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    shown.append(...formatMove(move, prefs.notation));
    const spoken = document.createElement('span');
    spoken.className = 'sr-only';
    spoken.textContent = move.san;
    return [`${Math.ceil(ply / 2)}${move.color === 'w' ? '.' : '…'} `, shown, spoken];
}

function statusText(): string {
    const game = controller.game;
    const result = controller.result;
    // Word joiners keep "1/2-1/2" from breaking at its hyphen when the line wraps.
    if (result) return `${result.reason} · ${result.result.replace('-', `${WORD_JOINER}-${WORD_JOINER}`)}`;
    if (controller.thinking) return 'The robot is thinking…';
    if (controller.needsRetry()) return 'The robot could not move';

    const check = game.isCheck() ? 'Check! ' : '';
    if (controller.mode.kind === 'robot') {
        return controller.isRobotTurn() ? `${check}Robot to move` : `${check}Your move`;
    }
    return `${check}${colorName(game.turn())} to move`;
}

function updatePanel() {
    const moves = controller.history();
    const ply = shownPly();
    const shownMoves = viewPly === null ? moves : moves.slice(0, ply);
    const game = shownGame();
    const bottom: Color = board.flipped ? 'b' : 'w';
    fillStrip(stripBottom, bottom, shownMoves, game);
    fillStrip(stripTop, bottom === 'w' ? 'b' : 'w', shownMoves, game);

    if (controller.result && viewPly !== null) statusLine.replaceChildren(...reviewStatus(viewPly));
    else statusLine.textContent = statusText();
    retryButton.hidden = !controller.needsRetry();
    renderHistory(historyList, moves, prefs.notation, ply, controller.result?.result);

    const reviewing = isReviewing();
    statusRow.classList.toggle('reviewing', reviewing);
    historyList.classList.toggle('reviewable', reviewing);
    reviewFirst.disabled = reviewPrev.disabled = ply === 0;
    reviewNext.disabled = reviewLast.disabled = ply === moves.length;

    undoButton.disabled = !controller.canUndo();
    surrenderButton.disabled = !!controller.result;
    pgnButton.disabled = moves.length === 0;
}

$('undo-btn').addEventListener('click', () => controller.undo());
retryButton.addEventListener('click', () => controller.retryRobot());

$('flip-btn').addEventListener('click', () => {
    board.setOrientation(board.flipped ? 'w' : 'b');
    updatePanel();
});

pgnButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(controller.pgn());
        showNotification('PGN copied to the clipboard');
    } catch {
        showNotification('Could not copy the PGN');
    }
});

surrenderButton.addEventListener('click', async () => {
    const mode = controller.mode;
    const question = mode.kind === 'robot'
        ? 'Surrender to the robot? Are you sure?'
        : `Surrender for ${colorName(controller.game.turn())}? Are you sure?`;
    if (await confirmAction(question, 'Surrender')) controller.surrender();
});

$('new-btn').addEventListener('click', async () => {
    if (hasGameInMemory() && !await confirmAction('Start a new game? The current game will be lost.', 'New game')) {
        return;
    }
    // Same mode, level and color as the current game; the menu is where those are changed.
    startGame(controller.mode);
});

// ---- Review --------------------------------------------------------------------------------------
// Once the game is over, the board can step back and forward through its moves: the buttons around
// the status line, a click on a move in the list, a swipe on the board, or the arrow keys.

// The number of plies on the board while reviewing, or null for the live (final) position.
let viewPly: number | null = null;
// Set from the end of the game until the game-over card opens, so a quick step back isn't then covered
// by the card (which shows the final result).
let overPending = false;

const isReviewing = () => !!controller.result && !overPending;
const shownPly = () => viewPly ?? controller.history().length;

/** The position on the board. Each verbose move carries the position after it, so nothing is replayed. */
function shownGame(): Chess {
    if (viewPly === null) return controller.game;
    return new Chess(viewPly ? controller.history()[viewPly - 1].after : DEFAULT_POSITION);
}

function showPly(ply: number) {
    const moves = controller.history();
    const from = shownPly();
    const to = Math.min(Math.max(ply, 0), moves.length);
    if (!isReviewing() || to === from) return;

    viewPly = to === moves.length ? null : to;
    const game = shownGame();
    // A single step forward animates like the move itself (a promoting pawn turns into its piece).
    const step = to === from + 1 ? moves[to - 1] : null;
    board.render(game, { move: step, animate: true, lastMove: moves[to - 1] });
    if (step) playSound(game.isCheck() ? 'check' : step.captured ? 'capture' : 'move');
    updatePanel();
}

reviewFirst.addEventListener('click', () => showPly(0));
reviewPrev.addEventListener('click', () => showPly(shownPly() - 1));
reviewNext.addEventListener('click', () => showPly(shownPly() + 1));
reviewLast.addEventListener('click', () => showPly(Infinity));

historyList.addEventListener('click', (e) => {
    const ply = (e.target as Element).closest<HTMLElement>('.ply')?.dataset.ply;
    if (ply && isReviewing()) showPly(Number(ply));
});

// Swipe left for the next move, right for the previous one. The board has touch-action: none, so the
// browser doesn't scroll or navigate. The release is watched on the window: a mouse can leave the board.
let swipe: { id: number; x: number; y: number } | null = null;

$('board').addEventListener('pointerdown', (e) => {
    swipe = isReviewing() && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
});
window.addEventListener('pointercancel', () => {
    swipe = null;
});
window.addEventListener('pointerup', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) showPly(shownPly() + (dx < 0 ? 1 : -1));
});

// ←/→ step and Home/End jump. Captured before the board's own arrow-key handling: once the game is
// over no piece can move, so the board's square-by-square focus (↑/↓ too) has no use and is switched off.
document.addEventListener('keydown', (e) => {
    if (!isReviewing() || app.dataset.screen !== 'game' || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as Element).closest('input, select, textarea, dialog')) return;
    const targets: Record<string, number | null> = {
        ArrowLeft: shownPly() - 1, ArrowRight: shownPly() + 1, Home: 0, End: Infinity, ArrowUp: null, ArrowDown: null,
    };
    if (!(e.key in targets)) return;
    e.preventDefault();
    e.stopPropagation();
    const ply = targets[e.key];
    if (ply !== null) showPly(ply);
}, { capture: true });

// ---- Game over -----------------------------------------------------------------------------------

const overDialog = $<HTMLDialogElement>('over-dialog');
let overTimer = 0;

function onGameOver(result: GameResult) {
    overPending = true;
    board.refresh();
    updatePanel();

    const mode = controller.mode;
    const humanWon = mode.kind === 'robot' ? result.winner === mode.humanColor : result.winner !== null;
    let title: string;
    if (!result.winner) title = 'Draw';
    else if (mode.kind === 'robot') title = humanWon ? 'You won!' : 'The robot won';
    else title = `${colorName(result.winner)} won!`;

    playSound(!result.winner ? 'draw' : humanWon ? 'win' : 'lose');
    $('over-title').textContent = title;
    $('over-reason').textContent = result.reason;
    $('over-score').textContent = result.result;
    $('over-icon').dataset.piece = `${result.winner ?? 'w'}K`;
    $('over-icon').classList.toggle('draw', !result.winner);

    const stats = recordGame(mode, result);
    const record = $('over-record');
    record.hidden = mode.kind !== 'robot';
    if (mode.kind === 'robot') record.textContent = `Level ${mode.level}: ${formatScore(stats.robot[mode.level])}`;

    // A short pause to see the final move first, then review starts and the card opens. The card is
    // skipped if the user has meanwhile started another game or left for the menu.
    clearTimeout(overTimer);
    overTimer = window.setTimeout(() => {
        if (controller.result !== result) return;
        overPending = false;
        updatePanel();
        if (app.dataset.screen !== 'game') return;
        overDialog.returnValue = '';
        overDialog.showModal();
        if (humanWon) confetti();
    }, 700);
}

overDialog.addEventListener('close', () => {
    if (overDialog.returnValue === 'again') startGame(controller.mode);
    else if (overDialog.returnValue === 'menu') $('menu-btn').click();
    // Land keyboard users on ◀. A game that ended before any move has nothing to step through (all the
    // nav buttons are disabled), so focus goes to New game instead.
    else if (overDialog.returnValue === 'review') (reviewPrev.disabled ? $('new-btn') : reviewPrev).focus();
});

// ---- Dialogs -------------------------------------------------------------------------------------

const promotionDialog = $<HTMLDialogElement>('promotion-dialog');

function choosePromotion(color: Color, to: Square): Promise<PieceSymbol | null> {
    return new Promise((resolve) => {
        for (const button of promotionDialog.querySelectorAll<HTMLButtonElement>('button[value]')) {
            button.querySelector<HTMLElement>('.pc')!.dataset.piece = `${color}${button.value.toUpperCase()}`;
        }
        // Dock the picker over the promotion square, as a column running into the board.
        const rect = board.squareRect(to);
        const fromTop = board.isTopRow(to);
        promotionDialog.classList.toggle('from-bottom', !fromTop);
        promotionDialog.style.setProperty('--sq', `${rect.width}px`);
        promotionDialog.style.left = `${rect.left}px`;
        promotionDialog.style.top = `${fromTop ? rect.top : rect.bottom - rect.width * 4}px`;

        promotionDialog.returnValue = '';
        promotionDialog.addEventListener('close', () => {
            resolve((promotionDialog.returnValue || null) as PieceSymbol | null);
        }, { once: true });
        promotionDialog.showModal();
    });
}

const confirmDialog = $<HTMLDialogElement>('confirm-dialog');

function confirmAction(text: string, yesLabel: string): Promise<boolean> {
    return new Promise((resolve) => {
        $('confirm-text').textContent = text;
        $('confirm-yes').textContent = yesLabel;
        confirmDialog.returnValue = '';
        confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'yes'), { once: true });
        confirmDialog.showModal();
    });
}

// A click on the backdrop closes a dialog. Clicks in the dialog's own padding also target the <dialog>
// element, so check the position instead, and only when the press started outside too (a drag that
// starts inside the card and ends on the backdrop must not close it).
function isOutside(dialog: HTMLDialogElement, e: MouseEvent): boolean {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

for (const dialog of document.querySelectorAll('dialog')) {
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = e.target === dialog && isOutside(dialog, e);
    });
    dialog.addEventListener('click', (e) => {
        if (pressedOutside && e.target === dialog && isOutside(dialog, e)) dialog.close();
        pressedOutside = false;
    });
}

// ---- Settings ------------------------------------------------------------------------------------

const settingsDialog = $<HTMLDialogElement>('settings-dialog');
const settingsForm = settingsDialog.querySelector('form')!;
const notationSelect = $<HTMLSelectElement>('notation-select');
const soundButton = $('sound-btn');

function syncSettingsForm() {
    setRadio('board', prefs.board);
    setRadio('pieces', prefs.pieces);
    setRadio('notation', prefs.notation);
    setRadio('orientation', prefs.localOrientation);
    settingsForm.querySelector<HTMLInputElement>('input[name="sound"]')!.checked = prefs.sound;
}

function applyPrefs() {
    app.dataset.board = prefs.board;
    app.dataset.pieces = prefs.pieces;
    notationSelect.value = prefs.notation;
    soundButton.setAttribute('aria-pressed', String(prefs.sound));
    savePrefs(prefs);
}

$('settings-btn').addEventListener('click', () => {
    syncSettingsForm();
    settingsDialog.showModal();
});

settingsForm.addEventListener('change', () => {
    const data = new FormData(settingsForm);
    prefs.board = data.get('board') as Prefs['board'];
    prefs.pieces = data.get('pieces') as Prefs['pieces'];
    prefs.notation = data.get('notation') as Prefs['notation'];
    prefs.localOrientation = data.get('orientation') as Prefs['localOrientation'];
    setRadio('menu-orientation', prefs.localOrientation);
    if (prefs.sound !== data.has('sound')) {
        prefs.sound = data.has('sound');
        setSoundEnabled(prefs.sound);
    }
    applyPrefs();

    // The 2-player board setting also applies to a 2-player game in progress.
    const mode = controller.mode;
    if (mode.kind === 'local' && mode.orientation !== prefs.localOrientation) {
        controller.mode = { kind: 'local', orientation: prefs.localOrientation };
        applyModeView();
    }
    updatePanel();
});

notationSelect.addEventListener('change', () => {
    prefs.notation = notationSelect.value as Prefs['notation'];
    applyPrefs();
    updatePanel();
});

soundButton.addEventListener('click', () => {
    prefs.sound = !prefs.sound;
    setSoundEnabled(prefs.sound);
    applyPrefs();
    playSound('move');
});

// ---- Toasts --------------------------------------------------------------------------------------
// Same pacing as before: a new message at most once a second, each one shown for 3 seconds.

const toasts = $('toasts');
const notificationQueue: string[] = [];
let isWaitingToPost = false;

function showNotification(message: string) {
    notificationQueue.push(message);
    if (!isWaitingToPost) processEntry();
}

function processEntry() {
    const message = notificationQueue.shift();
    if (message === undefined) {
        isWaitingToPost = false;
        return;
    }
    isWaitingToPost = true;
    createNotification(message);
    setTimeout(processEntry, 1000);
}

function createNotification(text: string) {
    // Re-show the popover so the toasts stay above a dialog opened after them.
    if (toasts.showPopover) {
        if (toasts.matches(':popover-open')) toasts.hidePopover();
        toasts.showPopover();
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    toasts.append(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
            if (!toasts.childElementCount && toasts.matches(':popover-open')) toasts.hidePopover();
        }, 500);
    }, 3000);
}

// ---- Start ---------------------------------------------------------------------------------------

applyPrefs();
setSoundEnabled(prefs.sound);
syncSettingsForm();
updatePanel();
history.replaceState({ screen: 'menu' }, '');
showScreen('menu');
