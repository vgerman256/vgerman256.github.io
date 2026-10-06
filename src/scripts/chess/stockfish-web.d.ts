// Types for the frozen classic script public/js/StockfishWeb.js, which defines a global class.
declare class StockfishWeb {
    constructor(path: string);
    worker: Worker;
    init(): Promise<void>;
    getBestMoveFen(fen: string, time?: number): Promise<string | null>;
    setEngineDifficulty(level: number | string): Promise<void>;
}
