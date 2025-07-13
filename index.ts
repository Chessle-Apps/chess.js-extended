import { Chess } from "chess.js";
import { getStockfishJs, getStockfishWasmJs } from "./stockfish-bundle";
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
  /** Number of principal variations to search for (default: 1) */
  multiPV?: number;
}

// Define the structure for a single analysis line
export interface AnalysisLine {
  evaluation: number | string;
  line: string[];
}

export class ChessEngine extends Chess {
  public lines: AnalysisLine[];

  constructor() {
    super();
    this.lines = [];
  }

  async evaluatePosition(
    options: StockfishOptions = {},
  ): Promise<AnalysisLine[]> {
    // Check if we're in a browser environment
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      throw new Error(
        "ChessEngine requires a browser environment with Web Worker support",
      );
    }

    return new Promise((resolve, reject) => {
      let stockfishWorkerUrl: string;

      // If a custom URL is provided, use it
      if (options.stockfishUrl) {
        stockfishWorkerUrl = options.stockfishUrl;
      } else {
        // Use bundled Stockfish files
        const wasmSupported =
          typeof WebAssembly === "object" &&
          WebAssembly.validate(
            Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00),
          );

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
      let timeoutId: ReturnType<typeof setTimeout>;

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
        reject(
          new Error(
            `Stockfish worker failed to load. ${
              error.message || "Check browser console for details."
            }`,
          ),
        );
      };

      // Set a timeout to prevent hanging (default 30 seconds)
      const timeoutMs = options.movetime || 30000;
      timeoutId = setTimeout(() => {
        console.warn(
          `Stockfish evaluation timed out after ${timeoutMs}ms, returning empty analysis.`,
        );
        cleanup();
        this.lines = [];
        resolve([]);
      }, timeoutMs);

      // Extract side to move from FEN
      const sideToMove = this.fen().split(" ")[1];

      // Keep track of the latest evaluation results for all lines
      const analysisLines: AnalysisLine[] = [];

      stockfish.addEventListener("message", (e) => {
        const message = e.data;
        // Parse multipv lines
        const multipvMatch = message.match(
          /multipv\s+(\d+).*score (cp|mate) (-?\d+).*pv\s+(.+)/,
        );

        if (multipvMatch) {
          const pvIndex = parseInt(multipvMatch[1], 10) - 1;
          const evalType = multipvMatch[2];
          const evalValue = parseInt(multipvMatch[3], 10);
          const pvLine = multipvMatch[4].trim().split(/\s+/);

          if (pvLine.length > 0) {
            const sanLine = this.convertMovesToSAN(pvLine, this.fen());

            // Calculate evaluation
            let adjustedEval: number | string;
            if (evalType === "cp") {
              adjustedEval =
                sideToMove === "b" ? -evalValue / 100 : evalValue / 100;
            } else {
              // Handle mate scores with proper notation
              const mateInMoves = Math.abs(evalValue);
              if (evalValue > 0) {
                // Mate for current side to move
                adjustedEval =
                  sideToMove === "w" ? `M${mateInMoves}` : `M-${mateInMoves}`;
              } else {
                // Mate against current side to move
                adjustedEval =
                  sideToMove === "w" ? `M-${mateInMoves}` : `M${mateInMoves}`;
              }
            }
            // Store the result for this PV index
            analysisLines[pvIndex] = {
              evaluation: adjustedEval,
              line: sanLine,
            };
          }
        }

        // Parse best move - this indicates Stockfish has finished analyzing
        const bestMoveMatch = message.match(/bestmove\s+(\S+)/);
        if (bestMoveMatch) {
          cleanup();

          // Filter out any empty slots in case of sparse multipv data
          const finalLines = analysisLines.filter(Boolean);
          this.lines = finalLines;
          resolve(finalLines);
        }
      });

      // Send commands to stockfish
      try {
        stockfish.postMessage("uci");
        // Set MultiPV option if provided
        const multiPV = options.multiPV || 1;
        stockfish.postMessage(`setoption name MultiPV value ${multiPV}`);
        stockfish.postMessage(`position fen ${this.fen()}`);

        // Build the go command with options
        let goCommand = "go";
        if (options.depth !== undefined) {
          goCommand += ` depth ${options.depth}`;
        } else if (options.time !== undefined) {
          goCommand += ` wtime ${options.time} btime ${options.time}`;
        } else if (options.movetime !== undefined) {
          goCommand += ` movetime ${options.movetime}`;
        } else if (options.nodes !== undefined) {
          goCommand += ` nodes ${options.nodes}`;
        } else {
          // Default to depth 15 if no options provided
          goCommand += " depth 15";
        }

        stockfish.postMessage(goCommand);
      } catch (error) {
        cleanup();
        reject(new Error(`Failed to send commands to Stockfish: ${error}`));
      }
    });
  }

  convertMovesToSAN(moves: string[], position: string): string[] {
    const chess = new Chess(position);
    const convertedMoves: string[] = [];

    for (const move of moves) {
      try {
        // Make the move and get its SAN notation
        const moveObj = chess.move(move);

        if (moveObj) {
          convertedMoves.push(moveObj.san);
        }
      } catch (error) {
        break;
      }
    }

    return convertedMoves;
  }
}
