// Entry point: wires the menu, the board, the side panel, the dialogs and the settings to the GameController.
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { BoardView } from './board-view';
import { confetti, playSound, setSoundEnabled } from './effects';
import { GameController, colorName, modeFromSaved, type GameMode, type GameResult } from './game';
import { renderCaptured, renderHistory } from './notation';
import { clampLevel, loadPrefs, loadSavedGame, savePrefs, type Prefs } from './prefs';

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

function fillStrip(strip: HTMLElement, color: Color, moves: Move[]) {
    const game = controller.game;
    strip.querySelector<HTMLElement>('.player-color')!.dataset.piece = `${color}K`;
    strip.querySelector('.player-name')!.textContent = controller.playerName(color);
    strip.querySelector<HTMLElement>('.thinking')!.hidden = !(controller.thinking && game.turn() === color);
    strip.classList.toggle('to-move', !controller.result && game.turn() === color);
    renderCaptured(strip.querySelector('.captured')!, moves, color, game);
}

function statusText(): string {
    const game = controller.game;
    const result = controller.result;
    if (result) return `${result.reason} · ${result.result}`;
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
    const bottom: Color = board.flipped ? 'b' : 'w';
    fillStrip(stripBottom, bottom, moves);
    fillStrip(stripTop, bottom === 'w' ? 'b' : 'w', moves);

    statusLine.textContent = statusText();
    retryButton.hidden = !controller.needsRetry();
    renderHistory(historyList, moves, prefs.notation, controller.result?.result);

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

// ---- Game over -----------------------------------------------------------------------------------

const overDialog = $<HTMLDialogElement>('over-dialog');
let overTimer = 0;

function onGameOver(result: GameResult) {
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

    // A short pause to see the final move first. Skipped if the user has meanwhile started another game
    // or left for the menu.
    clearTimeout(overTimer);
    overTimer = window.setTimeout(() => {
        if (controller.result !== result || app.dataset.screen !== 'game') return;
        overDialog.returnValue = '';
        overDialog.showModal();
        if (humanWon) confetti();
    }, 700);
}

overDialog.addEventListener('close', () => {
    if (overDialog.returnValue === 'again') startGame(controller.mode);
    else if (overDialog.returnValue === 'menu') $('menu-btn').click();
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
