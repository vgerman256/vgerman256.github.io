import { Chess, Move } from './chess.js';

const game = new Chess();
window.chessGame = game;

function initNewChessGame() {
    const game = new Chess();
    window.chessGame = game;
}

let stateBoardJs = []

const whiteColor = '#2D2D2D'
const blackColor = '#1A1A1A'

const blackBoxColor = '#6B4423'
const whiteBoxColor = '#F5F5DC'

const computerLastMoveColor = '#4A90D9'
const blueDotColor = 'blue'

let selectedSquare = [-1, -1];

let selectedPiece = ''
let possibleMovesVerbose = []

const pieceToUtf8Image = new Map([
    ['p', '\u2659'],
    ['r', '\u2656'],
    ['n', '\u2658'],
    ['b', '\u2657'],
    ['q', '\u2655'],
    ['k', '\u2654'],

    ['P', '\u265F'],
    ['R', '\u265C'],
    ['N', '\u265E'],
    ['B', '\u265D'],
    ['Q', '\u265B'],
    ['K', '\u265A']
]);

const leters = "abcdefgh";

const newGameButton = document.getElementById('newGameButton');
const difficultyInput = document.getElementById('difficultyInput');
const surrenderButton = document.getElementById('surrenderButton');
const surrenderDialog = document.getElementById('surrenderDialog');
const undoButton = document.getElementById('undoButton');
const blackCaptured = document.getElementById('blackCaptured');
const whiteCaptured = document.getElementById('whiteCaptured');

newGameButton.addEventListener('click', () => {
    const level = difficultyInput.value;
    setEngineDifficulty(level);

    initNewGame();

    drawChess();
    updateMoveHistory();
    updateButtonsState();
});

function isWithRobotPlay() {
    return document.getElementById("gameType").checked;
}

function defaultButtonState() {
    let isGgameInProgress = false;
    difficultyInput.disabled = isGgameInProgress;
    newGameButton.disabled = isGgameInProgress;
    surrenderButton.disabled = !isGgameInProgress;
    undoButton.disabled = !isGgameInProgress;
}

function updateButtonsState() {
    let isGgameInProgress = window.chessGame && !window.chessGame.isGameOver();
    difficultyInput.disabled = isGgameInProgress;
    newGameButton.disabled = isGgameInProgress;
    surrenderButton.disabled = !isGgameInProgress;
    undoButton.disabled = !isGgameInProgress;
}

surrenderButton.addEventListener('click', () => {
    surrenderDialog.showModal();
});

surrenderDialog.addEventListener('close', () => {
    if (surrenderDialog.returnValue === 'yes') {
        surrenderGame();
    }
});

var wasmSupported = typeof WebAssembly === 'object' && WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));

// ToDo: make it lazy!
let stockfishWeb = new StockfishWeb(wasmSupported ? './js/stockfish.wasm.js' : './js/stockfish.js');

async function setEngineDifficulty(level) {
    await stockfishWeb.setEngineDifficulty(level)
}

async function getComputerMoveAsync(move) {
    let fenPos = move.after;
    return await stockfishWeb.getBestMoveFen(fenPos);
}

function addGameResult(item) {
    const htmlMovesHistory = document.querySelector('#movesHistiry');
    let li = document.createElement('li');
    li.textContent = item;
    htmlMovesHistory.prepend(li)
}

function initNewGame() {
    initNewChessGame();
    var board = window.chessGame.board();
    stateBoardJs = [...board]

    initStockfishWeb();
    blackCaptured.innerText = whiteCaptured.innerText = '';
    showNotification("New game started, white moves first!");
}

function setEmptyBoard() {
    for (var j = 0; j < 8; ++j) {
        stateBoardJs[j] = new Array(8)
    }
}

const htmlMovesHistory = document.querySelector('#movesHistiry');
function clearBoard() {
    setEmptyBoard();
    drawChess();

    defaultButtonState();
    htmlMovesHistory.innerHTML = '';
}

function surrenderGame() {
    clearBoard()
    var msg = "Black won, white surrendered"
    showNotification(`${msg}!`)
    updateMoveHistory()
    addGameResult(msg)
}

function updateMoveHistory(groupByTwo = true) {
    blackCaptured.innerText = whiteCaptured.innerText = ''
    let history = window.chessGame.history({ verbose: true });

    // 1. Generate the individual move strings first
    let moveStrings = history.toReversed().map(move => {
        let p = move.color == 'b' ? move.piece.toUpperCase() : move.piece;
        let line = `${pieceToUtf8Image.get(p)} ${move.from} - ${move.to}`;

        if (move.isCapture()) {
            let cp = move.color != 'b' ? move.captured.toUpperCase() : move.captured;
            let pieceSymbol = ` ${pieceToUtf8Image.get(cp)}`;
            line += pieceSymbol;

            if (move.color == 'b') {
                blackCaptured.innerText += pieceSymbol;
            } else {
                whiteCaptured.innerText += pieceSymbol;
            }
        }
        return line;
    });

    let groupedHistory = groupByTwo ? [] : moveStrings.map(h => `<li>${h}</li>`);
    if (groupByTwo) {
        for (let i = 0; i < moveStrings.length; i += 2) {
            // Join the current move and the next one if it exists
            let pair = moveStrings.slice(i, i + 2).reverse().join(' ');
            groupedHistory.push(`<li>${pair}</li>`);
        }
    }

    htmlMovesHistory.innerHTML = groupedHistory.join('');
}

async function initStockfishWeb() {
    await stockfishWeb.init();

    const move = await stockfishWeb.getBestMove('e2e4', 1000);
    console.log('Best answe Stockfish:', move); // like "b8c6"
}

function drawCoordinates() {
    const canvas = document.getElementById("canvas-border");
    const ctx = canvas.getContext("2d");

    console.log("Font: " + ctx.font)
    ctx.font = "14px sans-serif"

    // white letters (top) - rotated 180 degrees
    ctx.fillStyle = blackBoxColor;
    const leters1 = leters.toUpperCase();

    let wOffset = Math.trunc(2 * boxWidth() / 3);
    let hOffset = Math.trunc(2 * boxHeight() / 3);
    for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.translate(i * boxWidth() + wOffset, 5);
        ctx.rotate(Math.PI); // 180 degrees
        ctx.fillText(leters1[i], 0, 0);
        ctx.restore();
    }

    // white letters (bottom) - normal orientation
    for (let i = 0; i < 8; i++) {
        ctx.fillText(leters1[i], i * boxWidth() + wOffset, chessHeight() + 35);
    }

    // white numbers (left side)
    for (let i = 0; i < 8; i++) {
        ctx.fillText(8 - i, 5, i * boxHeight() + hOffset);
    }

    // white numbers (right side)
    for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.translate(chessWidth() + 33, i * boxHeight() + hOffset);
        ctx.rotate(Math.PI); // 180 degrees
        ctx.fillText(8 - i, 0, 0);
        ctx.restore();
    }
}

// 0, 0  -> a8
function toChessNotation(x, y) {
    return `${leters[x]}${8 - y}`
}

// a7 -> 0, 1
function fromChessNotation(a1) {
    return [parseInt(leters.indexOf(a1[0])), 8 - parseInt(a1[1])]
}

function handleSelect(xC, yC) {
    // deselect old
    if (selectedSquare[0] == -1) {
        let c = colorFromPos(selectedSquare[0], selectedSquare[1]);
        drawSelected(selectedSquare[0], selectedSquare[1], c);
    }

    selectedSquare[0] = xC;
    selectedSquare[1] = yC;
    let p = getStateBoard(selectedSquare[0], selectedSquare[1]);

    // Unable to select not moving color
    if (p && isWhitePiece(p) && window.chessGame.turn() !== 'w' ||
        p && !isWhitePiece(p) && window.chessGame.turn() !== 'b') {
        possibleMovesVerbose = [];
        selectedSquare = [-1, -1];
        return;
    }

    drawSelected(xC, yC)

    if (p) {
        let pos = toChessNotation(selectedSquare[0], selectedSquare[1])
        console.log("Event: Slected " + p + ' at ' + pos);
        let pMoves = window.chessGame.moves({ square: pos, verbose: false })
        console.log(`Possible Moves raw: ${pMoves}`)

        let pMovesV = window.chessGame.moves({ square: pos, verbose: true })
        console.log(`Possible Moves verbose: ${objToString(pMovesV)}`)

        selectedPiece = p;
        possibleMovesVerbose = pMovesV;
        addPossibleMovesBlueDots();
    } else {
        possibleMovesVerbose = []
    }
}

function objToString(obj) {
    if (Array.isArray(obj)) {
        let aText = '['
        let first = true;
        obj.forEach(o => {
            aText += objToString(o) + ", ";
        });

        aText += ']'
        return aText;
    }

    let text = "";
    for (let x in obj) {
        text += x + ":" + obj[x] + ", ";
    };

    return text;
}

const chessCanvas = document.getElementById('canvas-chess');

function boxWidth() {
    return chessCanvas.width / 8;
}

function boxHeight() {
    return chessCanvas.height / 8
}

function chessWidth() {
    return chessCanvas.width;
}

function chessHeight() {
    return chessCanvas.height;
}

let pendingMove = null;
function handlePromotion(move, allowedMoves) {
    pendingMove = {
        move: move,
        allowedMoves: [...possibleMovesVerbose]
    };

    document.getElementById('promotion-modal').style.display = 'block';
    return;
}

function selectPromotion(pieceType) {
    if (pendingMove) {

        // Hide modal and refresh UI
        document.getElementById('promotion-modal').style.display = 'none';

        let refinedMove = pendingMove.allowedMoves.find(x => x.to == pendingMove.move.to && x.promotion == pieceType);
        pendingMove = null;
        doMove(refinedMove, true)
    }
}

async function doMove(allowedUserMove, promotionHandled = false) {
    try {
        if (allowedUserMove.isPromotion() && !promotionHandled) {
            handlePromotion(allowedUserMove, possibleMovesVerbose);
            return
        }

        let moveResult = window.chessGame.move(allowedUserMove);
        console.log("Move: " + objToString(moveResult));

        updateStateBoard(window.chessGame.board(), moveResult);
        removePossibleMovesBlueDots();

        updateMoveHistory()
        let canMove = handleGameState(moveResult);

        if (canMove && isWithRobotPlay()) {
            computerMove = await getComputerMoveAsync(moveResult);
            let computerMoveResult = window.chessGame.move(computerMove);
            updateStateBoard(window.chessGame.board(), computerMoveResult);
            updateMovedSelection()
            updateMoveHistory()
            handleGameState(computerMoveResult);
        }
    } catch (error) {
        console.log(`Bad move: ${allowedUserMove.p} ${allowedUserMove.to}`);
        removePossibleMovesBlueDots();
        return;
    }
}

chessCanvas.addEventListener('click', handleCanvasClick);
function handleCanvasClick(event) {
    const rect = chessCanvas.getBoundingClientRect();

    // Calculate coordinates relative to the canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log("Event: x = " + x + " y = " + y);
    var xC = Math.trunc(x / boxWidth());
    var yC = Math.trunc(y / boxHeight());
    console.log("Event: xC = " + xC + " yC = " + yC);

    const newSelected = [xC, yC]

    // not yet selected
    if (selectedSquare[0] == -1) {
        console.log("Event: Select");
        handleSelect(xC, yC);
    } else if (!compareArrays(selectedSquare, newSelected)) {
        // deselect old
        let [xWas, yWas] = selectedSquare;
        drawSelected(xWas, yWas, colorFromPos(xWas, yWas));
        let p = getStateBoard(xWas, yWas)

        let cTo = toChessNotation(xC, yC);
        let allowedUserMove = possibleMovesVerbose.find(v => v.to == cTo);
        // clear blue dots

        if (p && allowedUserMove) {
            selectedSquare = [-1, -1];

            doMove(allowedUserMove).then(() => {
                console.log("Event: Move Piece: " + p);
            });
        } else {
            removePossibleMovesBlueDots();
            handleSelect(xC, yC);
            console.log("Event: Select 1");
        }
    } else {
        removePossibleMovesBlueDots();
        let c = colorFromPos(selectedSquare[0], selectedSquare[1]);
        drawSelected(selectedSquare[0], selectedSquare[1], c);

        selectedSquare = [-1, -1];
        console.log("Event: Deselect");
    }
}

function handleGameState(move) {
    var nextTurn = window.chessGame.turn();
    let prevColor = nextTurn == 'w' ? 'Black' : 'White'
    let nextColor = nextTurn == 'b' ? 'Black' : 'White'

    if (move.isCapture()) {
        let cp = pieceToUtf8Image.get(move.captured);
        showNotification(`${cp} captured!`)
    }
    if (move.isPromotion()) {
        let cp = pieceToUtf8Image.get(move.promotion);
        showNotification(`${cp} promotion!`)
    }

    if (window.chessGame.isGameOver()) {
        if (window.chessGame.isDraw()) {
            let msg = "Draw! No winers..."
            showNotification(msg)
            addGameResult("1/2-1/2")
            addGameResult(msg)
        } else {
            var msg = `${prevColor} won`
            showNotification(`${msg}!`)
            addGameResult(nextTurn == 'w' ? "0-1" : "1-0")
            addGameResult(msg)
        }

        updateButtonsState();
        return false;
    }

    if (window.chessGame.isCheck()) {
        showNotification(`Check to ${nextColor}!`)
    }

    return true;
}

function undoMove() {

    console.log("Undo last move: next turns " + window.chessGame.turn())
    updateMovedSelection(true)

    for (var i = 0; i < 2; ++i) {
        let move1 = window.chessGame.undo();
        if (!move1) {
            showNotification("Nothing to undo!")
            return;
        }

        console.log(`Undone move: ${objToString(move1)}`)
        updateStateBoard(window.chessGame.board(), move1)
    }
    updateMoveHistory();
    console.log("Next turns: " + window.chessGame.turn())
}

function isEqualObj(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function updateStateBoard(newBoardJs, move) {
    stateBoardJs = newBoardJs;

    let [fx, fy] = fromChessNotation(move.from)
    let [tx, ty] = fromChessNotation(move.to)

    updateStateAt(fx, fy);

    let lineUpdate = move.isKingsideCastle() || move.isQueensideCastle()
    if (!lineUpdate) {
        updateStateAt(tx, ty);
    } else {
        for (var x = 0; x < 8; x++) {
            updateStateAt(x, ty);
        }
    }
    if (move.isEnPassant()) {
        updateStateAt(tx, fy);
    }
}

function updateMovedSelection(isforUndo = false) {
    let history = window.chessGame.history({ verbose: true })
    var last3 = history.slice(-3);

    if (isforUndo && last3.length == 3)
        last3.reverse();
    else if (isforUndo && last3.length != 3) {
        drawSelectedMove(last3.pop())
        return;
    }

    if (last3.length == 3) {
        drawSelectedMove(last3[0]);
    }

    drawSelectedMove(last3.pop(), computerLastMoveColor)
}

function addPossibleMovesBlueDots() {
    possibleMovesVerbose.forEach(move => {
        let [x, y] = fromChessNotation(move.to);
        drawBlueDot(posToC(x) + boxWidth() / 2, posToC(y) + boxHeight() / 2)
    });
}

function removePossibleMovesBlueDots() {
    possibleMovesVerbose.forEach(move => {
        let [x, y] = fromChessNotation(move.to);
        updateStateAt(x, y);
    });

    possibleMovesVerbose = []
    selectedPiece = ''
}

function drawSelected(xC, yC, color = blueDotColor) { // '#4A90D9'
    const ctx = chessCanvas.getContext("2d");
    console.log("Event: " + color);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(posToC(xC), posToC(yC), boxWidth(), boxHeight());
}

function drawSelectedMove(move, color) {
    [fromChessNotation(move.from), fromChessNotation(move.to)]
        .forEach(([x, y]) =>
            drawSelected(x, y, color ? color : colorFromPos(x, y)));
}

function colorFromPos(xC, yC) {
    if (yC % 2 == 0 && xC % 2 == 0) {
        return whiteBoxColor;
    }
    if (yC % 2 != 0 && xC % 2 != 0)
        return whiteBoxColor;
    return blackBoxColor;
}

function fillBoard() {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            updateStateAt(j, i)
        }
    }
}

function getStateBoard(x, y) {
    var p = stateBoardJs[y][x];
    if (!p)
        return p;

    if (p.color == 'b')
        return p.type.toUpperCase();
    return p.type;
}

function updateStateAt(x, y) {
    const ctx = chessCanvas.getContext("2d");
    let piece = getStateBoard(x, y);
    let color = colorFromPos(x, y);
    ctx.fillStyle = color;
    ctx.fillRect(posToC(x), posToC(y), boxWidth(), boxHeight());

    drawPiece(ctx, boxWidth() / 2 + posToC(x), boxHeight() / 2 + posToC(y), piece)
}

function drawChess() {
    fillBoard();
    drawCoordinates();
}

function posToC(x) {
    return boxWidth() * x;
}

function isWhitePiece(piece) {
    return piece === piece.toLowerCase() &&
        piece !== piece.toUpperCase();
}

function drawPiece(ctx, x, y, piece) {
    // R Q - black rook and black queen
    // r k - white rook and white king
    let fontsize = Math.trunc(2 * boxWidth() / 3)
    ctx.font = `${fontsize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (!piece) {
        ctx.fillText('', x, y);
        return;
    }

    const symbol = pieceToUtf8Image.get(piece);
    const isWhite = isWhitePiece(piece);

    ctx.fillStyle = isWhite ? whiteColor : blackColor;
    ctx.strokeStyle = isWhite ? '#FFFFFF' : '#000000';
    ctx.lineWidth = 1;

    // In two-player mode, rotate black pieces 180° to face the opponent
    const rotateForOpponent = !isWhite && !isWithRobotPlay();
    if (rotateForOpponent) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI);
        ctx.strokeText(symbol, 0, 0);
        ctx.fillText(symbol, 0, 0);
        ctx.restore();
    } else {
        ctx.strokeText(symbol, x, y);
        ctx.fillText(symbol, x, y);
    }
}

function drawBlueDot(x, y, color = blueDotColor) { // '#4A90D9' AI suggest
    const ctx = chessCanvas.getContext("2d");
    ctx.fillStyle = color == '' ? blueDotColor : color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 7 * Math.PI);
    ctx.stroke();
    ctx.fill();
}

function compareArrays(a, b) {
    return a.length === b.length &&
        a.every((element, index) => element === b[index]);
}

let notificationQueue = [];
let isWaitingToPost = false;

function showNotification(message) {
    notificationQueue.push(message);
    if (!isWaitingToPost) {
        processEntry();
    }
}

function processEntry() {
    if (notificationQueue.length === 0) {
        isWaitingToPost = false;
        return;
    }

    isWaitingToPost = true;
    const message = notificationQueue.shift();
    createNotification(message);

    // Wait 1 second before allowing the next one to appear
    setTimeout(() => {
        processEntry();
    }, 1000);
}

function createNotification(text) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'notification';
    toast.innerText = text;

    container.appendChild(toast);

    // Each notification lives for exactly 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500); // Remove after fade animation
    }, 3000);
}

// Expose functions called via inline onclick attributes in HTML
window.undoMove = undoMove;
window.selectPromotion = selectPromotion;

clearBoard();
