class StockfishWeb {
    constructor(path) {
        this.worker = new Worker(path);
        this.resolvers = []; // Response queue
        this.depth = 0 // 0 = time-limited search (see getBestMoveFen); > 0 forces a fixed search depth
        this.moveTime = 1000 // ms per engine move; set per level in setEngineDifficulty
    }

    // Send and wait for token
    async send(command, waitToken) {
        return new Promise((resolve) => {
            const listener = (e) => {
                const line = e.data;
                if (typeof line === 'string' && line.includes(waitToken)) {
                    this.worker.removeEventListener('message', listener);
                    resolve(line);
                }
            };

            this.worker.addEventListener('message', listener);
            this.worker.postMessage(command);
        });
    }

    async init() {
        await this.send('uci', 'uciok');
        await this.send('isready', 'readyok');
        console.log('Stockfish WASM готов к работе');
    }

    async getBestMove(moves = '', time = 1000) {
        const posCommand = moves ? `position startpos moves ${moves}` : 'position startpos';

        this.worker.postMessage(posCommand);
        const response = await this.send(`go movetime ${time}`, 'bestmove');

        // Extract from string like "bestmove e2e4 ponder e7e5"
        const match = response.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
        return match ? match[1] : null;
    }

    async getBestMoveFen(fen, time = this.moveTime) {
        this.worker.postMessage(`position fen ${fen}`);

        // Make sure the engine is good
        await this.send('isready', 'readyok');

        // depth 0 (the default) = no fixed depth: think for `time` ms, which scales with the level.
        // Set this.depth > 0 to search to exactly that depth instead (e.g. for testing).
        const response = this.depth > 0
            ? await this.send(`go depth ${this.depth}`, 'bestmove')
            : await this.send(`go movetime ${time}`, 'bestmove');

        // Looking for "bestmove [ход]", где ход — это 4-5 символов (e2e4, a7a8q)
        const match = response.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
        return match ? match[1] : null;
    }

    async setEngineDifficulty(level) {
        console.log(`Set skill level: ${level}`);

        // Thinking time grows with the level: 100 ms at level 0 up to 2 s at level 20.
        // The level comes from a text input, so coerce it and clamp to the valid 0-20 range.
        const clampedLevel = Math.min(Math.max(Number(level) || 0, 0), 20);
        this.moveTime = 100 + clampedLevel * 95;

        this.worker.postMessage(`setoption name Skill Level value ${clampedLevel}`);
        await this.send('isready', 'readyok');
    }
}
