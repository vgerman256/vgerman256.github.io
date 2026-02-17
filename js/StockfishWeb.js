class StockfishWeb {
    constructor(path) {
        this.worker = new Worker(path);
        this.resolvers = []; // Response queue
        this.depth = 20
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

    async getBestMoveFen(fen, time = 1000) {
        this.worker.postMessage(`position fen ${fen}`);

        // Make sure the engine is good
        await this.send('isready', 'readyok');

        const response = this.depth > 1
            ? await this.send(`go movetime ${time}`, 'bestmove') :
            await this.send(`go depth ${this.depth}`, 'bestmove');

        // Looking for "bestmove [ход]", где ход — это 4-5 символов (e2e4, a7a8q)
        const match = response.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
        return match ? match[1] : null;
    }

    async setEngineDifficulty(level) {
        console.log(`Set skill level: ${level}`);

        if (level <= 2)
            this.depth = 1

        this.worker.postMessage(`setoption name Skill Level value ${level}`);
        await this.send('isready', 'readyok');
    }
}
