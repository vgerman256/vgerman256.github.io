// Thin wrapper around the global StockfishWeb (public/js/StockfishWeb.js, loaded with is:inline).
// StockfishWeb.send() resolves on the first worker line that contains the awaited token, so two calls in
// flight at once can resolve each other (specs/chess-known-issues.md #1). Every call is therefore queued
// and runs only after the previous one has finished.

const wasmSupported = typeof WebAssembly === 'object'
    && WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));

let engine: StockfishWeb | null = null;
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: (engine: StockfishWeb) => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
        if (!engine) {
            engine = new StockfishWeb(wasmSupported ? '/js/stockfish.wasm.js' : '/js/stockfish.js');
            await engine.init();
        }
        return task(engine);
    });
    queue = run.catch(() => undefined);
    return run;
}

export function setEngineLevel(level: number): Promise<void> {
    return enqueue((e) => e.setEngineDifficulty(level));
}

export function getBestMove(fen: string): Promise<string | null> {
    return enqueue((e) => e.getBestMoveFen(fen));
}
