import { Chess } from "chess.js";
import { getStockfishJs, getStockfishWasmJs } from "./stockfish-bundle";
export * from "chess.js";
export class ChessEngine extends Chess {
    constructor() {
        super();
        this.evaluation = 0;
        this.bestMove = undefined;
        this.suggestedLine = [];
    }
    async evaluatePosition(options = {}) {
        // Check if we're in a browser environment
        if (typeof window === "undefined" || typeof Worker === "undefined") {
            throw new Error("ChessEngine requires a browser environment with Web Worker support");
        }
        return new Promise((resolve, reject) => {
            let stockfishWorkerUrl;
            // If a custom URL is provided, use it
            if (options.stockfishUrl) {
                stockfishWorkerUrl = options.stockfishUrl;
            }
            else {
                // Use bundled Stockfish files
                const wasmSupported = typeof WebAssembly === "object" &&
                    WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
                const stockfishCode = wasmSupported
                    ? getStockfishWasmJs()
                    : getStockfishJs();
                // Create a blob URL from the bundled code
                const blob = new Blob([stockfishCode], {
                    type: "application/javascript",
                });
                stockfishWorkerUrl = URL.createObjectURL(blob);
            }
            const stockfish = new Worker(stockfishWorkerUrl);
            // Declare timeout variable
            let timeoutId;
            const cleanup = () => {
                stockfish.terminate();
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                // Clean up blob URL if we created one
                if (!options.stockfishUrl && stockfishWorkerUrl.startsWith("blob:")) {
                    URL.revokeObjectURL(stockfishWorkerUrl);
                }
            };
            // Add error handling for worker
            stockfish.onerror = (error) => {
                console.error("Stockfish worker error:", error);
                cleanup();
                reject(new Error(`Stockfish worker failed to load. ${error.message || "Check browser console for details."}`));
            };
            // Set a timeout to prevent hanging (default 30 seconds)
            const timeoutMs = options.movetime || 30000;
            timeoutId = setTimeout(() => {
                console.warn(`Stockfish evaluation timed out after ${timeoutMs}ms, returning default evaluation`);
                cleanup();
                // Return default evaluation instead of throwing an error
                const defaultResult = {
                    evaluation: 0,
                    bestMove: undefined,
                    suggestedLine: [],
                };
                this.suggestedLine = defaultResult.suggestedLine;
                this.evaluation = defaultResult.evaluation;
                this.bestMove = defaultResult.bestMove;
                resolve(defaultResult);
            }, timeoutMs);
            // Extract side to move from FEN
            const sideToMove = this.fen().split(" ")[1];
            // Keep track of the latest evaluation results
            let result = {
                evaluation: 0,
                bestMove: undefined,
                suggestedLine: [],
            };
            // Keep track of the latest line while analyzing
            let latestLine = [];
            stockfish.addEventListener("message", (e) => {
                const message = e.data;
                // Parse multipv lines
                const multipvMatch = message.match(/multipv\s+1.*score (cp|mate) (-?\d+).*pv\s+(.+)/);
                if (multipvMatch) {
                    const evalType = multipvMatch[1];
                    const evalValue = parseInt(multipvMatch[2], 10);
                    const pvLine = multipvMatch[3].trim().split(/\s+/);
                    if (pvLine.length > 0) {
                        // Just update the latest line, but don't set it as the final line yet
                        latestLine = this.convertMovesToSAN(pvLine, this.fen());
                        // Calculate evaluation
                        let adjustedEval;
                        if (evalType === "cp") {
                            adjustedEval =
                                sideToMove === "b" ? -evalValue / 100 : evalValue / 100;
                        }
                        else {
                            // Handle mate scores with proper notation
                            const mateInMoves = Math.abs(evalValue);
                            if (evalValue > 0) {
                                // Mate for current side to move
                                adjustedEval =
                                    sideToMove === "w" ? `M${mateInMoves}` : `M-${mateInMoves}`;
                            }
                            else {
                                // Mate against current side to move
                                adjustedEval =
                                    sideToMove === "w" ? `M-${mateInMoves}` : `M${mateInMoves}`;
                            }
                        }
                        result.evaluation = adjustedEval;
                    }
                }
                // Parse best move - this indicates Stockfish has finished analyzing
                const bestMove = message.match(/bestmove\s+(\S+)/)?.[1];
                if (bestMove) {
                    result.bestMove = bestMove;
                    // Now that Stockfish is done, set the final line
                    if (latestLine.length > 0) {
                        result.suggestedLine = latestLine;
                    }
                    cleanup();
                    this.suggestedLine = result.suggestedLine;
                    this.evaluation = result.evaluation;
                    this.bestMove = result.bestMove;
                    resolve(result);
                }
            });
            // Send commands to stockfish
            try {
                stockfish.postMessage("uci");
                stockfish.postMessage("setoption name MultiPV value 1");
                stockfish.postMessage(`position fen ${this.fen()}`);
                // Build the go command with options
                let goCommand = "go";
                if (options.depth !== undefined) {
                    goCommand += ` depth ${options.depth}`;
                }
                else if (options.time !== undefined) {
                    goCommand += ` wtime ${options.time} btime ${options.time}`;
                }
                else if (options.movetime !== undefined) {
                    goCommand += ` movetime ${options.movetime}`;
                }
                else if (options.nodes !== undefined) {
                    goCommand += ` nodes ${options.nodes}`;
                }
                else {
                    // Default to depth 15 if no options provided
                    goCommand += " depth 15";
                }
                stockfish.postMessage(goCommand);
            }
            catch (error) {
                cleanup();
                reject(new Error(`Failed to send commands to Stockfish: ${error}`));
            }
        });
    }
    convertMovesToSAN(moves, position) {
        const chess = new Chess(position);
        const convertedMoves = [];
        for (const move of moves) {
            try {
                // Make the move and get its SAN notation
                const moveObj = chess.move(move);
                if (moveObj) {
                    convertedMoves.push(moveObj.san);
                }
            }
            catch (error) {
                break;
            }
        }
        return convertedMoves;
    }
}
//# sourceMappingURL=index.js.map