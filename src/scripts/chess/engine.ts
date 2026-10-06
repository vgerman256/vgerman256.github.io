// Thin wrapper around the global StockfishWeb (public/js/StockfishWeb.js, loaded with is:inline).
// StockfishWeb.send() resolves on the first worker line that contains the awaited token, so two calls in
// flight at once can resolve each other (specs/chess-known-issues.md #1). Every call is therefore queued
// and runs only after the previous one has finished.
//
// StockfishWeb itself never gives up: a worker that fails to load or stops answering would leave its
// promises pending forever and block the queue. Each step therefore gets a time limit and also fails on
// the worker's `error` event. After a failure the worker is terminated. Calls that were already waiting
// fail at once instead of each waiting out another start-up; the next new call starts a fresh worker.

const wasmSupported = typeof WebAssembly === 'object'
    && WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));

// Starting means downloading and compiling about 2 MB of engine; the longest search is 2 s (level 20).
const INIT_TIMEOUT_MS = 20_000;
const CALL_TIMEOUT_MS = 30_000;

let engine: StockfishWeb | null = null;
let queue: Promise<unknown> = Promise.resolve();
// The last requested skill level, applied again whenever a new worker starts.
let level = 0;
// Bumped on every failure, so calls queued before it can tell that the worker they waited for is gone.
let failures = 0;

function enqueue<T>(task: (engine: StockfishWeb) => Promise<T>): Promise<T> {
    const failuresWhenQueued = failures;
    const run = queue.then(async () => {
        if (failures !== failuresWhenQueued) throw new Error('Stockfish failed while this request was waiting');
        try {
            if (!engine) {
                engine = new StockfishWeb(wasmSupported ? '/js/stockfish.wasm.js' : '/js/stockfish.js');
                await guard(engine, engine.init(), INIT_TIMEOUT_MS, 'Stockfish did not start');
                await guard(engine, engine.setEngineDifficulty(level), CALL_TIMEOUT_MS, 'Stockfish did not start');
            }
            return await guard(engine, task(engine), CALL_TIMEOUT_MS, 'Stockfish did not answer');
        } catch (error) {
            engine?.worker.terminate();
            engine = null;
            failures++;
            throw error;
        }
    });
    queue = run.catch(() => undefined);
    return run;
}

/** `work`, but rejected if the worker reports an error or `ms` pass first. */
function guard<T>(e: StockfishWeb, work: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const onError = (event: ErrorEvent) => fail(`${message}: ${event.message || 'worker error'}`);
        const timer = setTimeout(() => fail(`${message} within ${ms / 1000} s`), ms);
        const cleanup = () => {
            clearTimeout(timer);
            e.worker.removeEventListener('error', onError);
        };
        const fail = (reason: string) => {
            cleanup();
            reject(new Error(reason));
        };

        e.worker.addEventListener('error', onError);
        work.then(
            (value) => {
                cleanup();
                resolve(value);
            },
            (error: unknown) => {
                cleanup();
                reject(error);
            },
        );
    });
}

export function setEngineLevel(newLevel: number): Promise<void> {
    level = newLevel;
    return enqueue((e) => e.setEngineDifficulty(newLevel));
}

export function getBestMove(fen: string): Promise<string | null> {
    return enqueue((e) => e.getBestMoveFen(fen));
}
