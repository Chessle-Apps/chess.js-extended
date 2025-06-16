import { Chess } from "chess.js";
export * from "chess.js";
export interface StockfishOptions {
    /** Search depth (default: 15) */
    depth?: number;
    /** Thinking time in milliseconds */
    time?: number;
    /** Exact time to think in milliseconds */
    movetime?: number;
    /** Number of nodes to search */
    nodes?: number;
    /** Custom Stockfish worker URL (optional) */
    stockfishUrl?: string;
}
export declare class ChessEngine extends Chess {
    evaluation: number | string;
    bestMove: undefined | string;
    suggestedLine: string[];
    constructor();
    evaluatePosition(options?: StockfishOptions): Promise<{
        evaluation: number | string;
        bestMove: string | undefined;
        suggestedLine: string[];
    }>;
    convertMovesToSAN(moves: string[], position: string): string[];
}
//# sourceMappingURL=index.d.ts.map