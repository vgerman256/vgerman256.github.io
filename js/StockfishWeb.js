class StockfishWeb {
    constructor(path) {
        this.worker = new Worker(path);
        this.resolvers = []; // Очередь для обработки ответов
        this.depth = 5
    }

    // Универсальный метод отправки сообщения и ожидания токена
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

        // Устанавливаем позицию (она не возвращает подтверждения, поэтому просто шлем)
        this.worker.postMessage(posCommand);

        // Запрашиваем ход и ждем токен 'bestmove'
        const response = await this.send(`go movetime ${time}`, 'bestmove');

        // Извлекаем ход из строки "bestmove e2e4 ponder e7e5"
        const match = response.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
        return match ? match[1] : null;
    }

    async getBestMoveFen(fen, time = 1000) {
        // 1. Устанавливаем позицию через FEN
        // Движок не присылает подтверждения на эту команду, поэтому просто отправляем
        this.worker.postMessage(`position fen ${fen}`);

        // 2. Убеждаемся, что движок принял позицию и готов (опционально, но надежно)
        await this.send('isready', 'readyok');

        // 3. Запрашиваем анализ
        //const response = await this.send(`go movetime ${time}`, 'bestmove');
        const response = await this.send(`go depth ${this.depth}`, 'bestmove');

        // 4. Парсим результат с помощью регулярного выражения
        // Ищем строку "bestmove [ход]", где ход — это 4-5 символов (e2e4, a7a8q)
        const match = response.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);

        return match ? match[1] : null;
    }

    async setEngineDifficulty(level) {
        console.log(`Установка сложности: ${level}`);
        
        if (level == 0 )
            this.depth = 1
        else if (level > 0)
            this.depth = 5
        else if (level > 9)
            this.depth = 10
        else if (level > 14)
            this.depth = 20

        this.worker.postMessage(`setoption name Skill Level value ${level}`);
        await this.send('isready', 'readyok');
    }
}
