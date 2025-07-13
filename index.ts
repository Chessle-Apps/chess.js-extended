import { Chess } from "chess.js";
import { getStockfishJs, getStockfishWasmJs } from "./stockfish-bundle";
export * from "chess.js";

// A simple EventEmitter class
class EventEmitter<T> {
  private listeners: { [event: string]: ((data: T) => void)[] } = {};

  on(event: string, listener: (data: T) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: (data: T) => void): void {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  emit(event: string, data: T): void {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event].forEach((listener) => listener(data));
  }
}

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
  /** Skill level of the engine (0-20) */
  skillLevel?: number;
  /** Contempt factor for the engine (-100 to 100) */
  contempt?: number;
  /** Number of CPU threads to use */
  threads?: number;
  /** Hash table size in MB */
  hash?: number;
}

// Define the structure for a single analysis line
export interface AnalysisLine {
  evaluation: number | string;
  line: string[];
}

type EngineMode = "idle" | "evaluate" | "stream";

export class ChessEngine extends Chess {
  public lines: AnalysisLine[];
  private stockfish: Worker | null = null;
  private emitter = new EventEmitter<AnalysisLine[]>();
  private analysisLines: AnalysisLine[] = [];
  private stockfishWorkerUrl: string | null = null;
  private isuciok = false;
  private mode: EngineMode = "idle";

  constructor() {
    super();
    this.lines = [];
  }

  on(event: "analysis", listener: (data: AnalysisLine[]) => void): void {
    this.emitter.on(event, listener);
  }

  off(event: "analysis", listener: (data: AnalysisLine[]) => void): void {
    this.emitter.off(event, listener);
  }

  private _initializeWorker(options: StockfishOptions = {}): Worker {
    if (this.stockfish) {
      return this.stockfish;
    }

    if (typeof window === "undefined" || typeof Worker === "undefined") {
      throw new Error(
        "ChessEngine requires a browser environment with Web Worker support",
      );
    }

    if (options.stockfishUrl) {
      this.stockfishWorkerUrl = options.stockfishUrl;
    } else if (!this.stockfishWorkerUrl) {
      const wasmSupported =
        typeof WebAssembly === "object" &&
        WebAssembly.validate(
          Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00),
        );
      const stockfishCode = wasmSupported
        ? getStockfishWasmJs()
        : getStockfishJs();
      const blob = new Blob([stockfishCode], {
        type: "application/javascript",
      });
      this.stockfishWorkerUrl = URL.createObjectURL(blob);
    }

    this.stockfish = new Worker(this.stockfishWorkerUrl);
    this.isuciok = false;

    this.stockfish.onerror = (error) => {
      console.error("Stockfish worker error:", error);
      this.terminate();
    };

    this.stockfish.addEventListener("message", (e) => {
      this._handleStockfishMessage(e.data, options);
    });

    this._sendCommand("uci");
    return this.stockfish;
  }

  private _handleStockfishMessage(message: string, options: StockfishOptions) {
    if (message === "uciok") {
      this.isuciok = true;
      this._setOptions(options);
      return;
    }

    if (message.startsWith("bestmove")) {
      if (this.mode === "stream") {
        this.terminate();
      }
      return;
    }

    const sideToMove = this.fen().split(" ")[1];
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
        let adjustedEval: number | string;

        if (evalType === "cp") {
          adjustedEval =
            sideToMove === "b" ? -evalValue / 100 : evalValue / 100;
        } else {
          const mateInMoves = Math.abs(evalValue);
          adjustedEval =
            (evalValue > 0 && sideToMove === "w") ||
            (evalValue < 0 && sideToMove === "b")
              ? `M${mateInMoves}`
              : `M-${mateInMoves}`;
        }
        this.analysisLines[pvIndex] = {
          evaluation: adjustedEval,
          line: sanLine,
        };
        this.emitter.emit("analysis", this.analysisLines.filter(Boolean));
      }
    }
  }

  private _sendCommand(command: string) {
    if (this.stockfish) {
      this.stockfish.postMessage(command);
    }
  }

  private _setOptions(options: StockfishOptions) {
    if (options.multiPV)
      this._sendCommand(`setoption name MultiPV value ${options.multiPV}`);
    if (options.skillLevel)
      this._sendCommand(
        `setoption name Skill Level value ${options.skillLevel}`,
      );
    if (options.contempt)
      this._sendCommand(`setoption name Contempt value ${options.contempt}`);
    if (options.threads)
      this._sendCommand(`setoption name Threads value ${options.threads}`);
    if (options.hash)
      this._sendCommand(`setoption name Hash value ${options.hash}`);
  }

  startAnalysis(options: StockfishOptions = {}) {
    if (this.mode !== "idle") {
      console.warn("Engine is busy. Please stop the current analysis first.");
      return;
    }
    this.mode = "stream";
    this._initializeWorker(options);
    this.analysisLines = [];

    const checkUciOk = () => {
      if (this.isuciok) {
        this._sendCommand(`position fen ${this.fen()}`);
        this._sendCommand("go infinite");
      } else {
        setTimeout(checkUciOk, 50);
      }
    };
    checkUciOk();
  }

  stopAnalysis() {
    if (this.mode === "stream") {
      this._sendCommand("stop");
    }
  }

  terminate() {
    if (this.stockfish) {
      this._sendCommand("quit");
      this.stockfish.terminate();
      this.stockfish = null;
    }
    if (
      this.stockfishWorkerUrl &&
      this.stockfishWorkerUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(this.stockfishWorkerUrl);
      this.stockfishWorkerUrl = null;
    }
    this.isuciok = false;
    this.mode = "idle";
  }

  async evaluatePosition(
    options: StockfishOptions = {},
  ): Promise<AnalysisLine[]> {
    return new Promise((resolve, reject) => {
      if (this.mode !== "idle") {
        return reject(
          new Error("Engine is busy. Please stop the current analysis first."),
        );
      }
      this.mode = "evaluate";
      this._initializeWorker(options);
      this.analysisLines = [];

      const timeoutMs = options.movetime || 30000;
      const timeoutId = setTimeout(() => {
        this.terminate();
        console.warn(
          `Stockfish evaluation timed out after ${timeoutMs}ms, returning empty analysis.`,
        );
        resolve([]);
      }, timeoutMs);

      const messageHandler = (e: MessageEvent) => {
        if (e.data.startsWith("bestmove")) {
          clearTimeout(timeoutId);
          this.stockfish?.removeEventListener("message", messageHandler);
          const finalLines = [...this.analysisLines].filter(Boolean);
          this.lines = finalLines;
          this.terminate();
          resolve(finalLines);
        }
      };

      this.stockfish?.addEventListener("message", messageHandler);

      const checkUciOk = () => {
        if (this.isuciok) {
          this._sendCommand(`position fen ${this.fen()}`);
          let goCommand = "go";
          if (options.depth !== undefined)
            goCommand += ` depth ${options.depth}`;
          else if (options.time !== undefined)
            goCommand += ` wtime ${options.time} btime ${options.time}`;
          else if (options.movetime !== undefined)
            goCommand += ` movetime ${options.movetime}`;
          else if (options.nodes !== undefined)
            goCommand += ` nodes ${options.nodes}`;
          else goCommand += " depth 15";
          this._sendCommand(goCommand);
        } else {
          setTimeout(checkUciOk, 50);
        }
      };
      checkUciOk();
    });
  }

  convertMovesToSAN(moves: string[], position: string): string[] {
    const chess = new Chess(position);
    const convertedMoves: string[] = [];

    for (const move of moves) {
      try {
        const moveObj = chess.move(move);
        if (moveObj) {
          convertedMoves.push(moveObj.san);
        }
      } catch (error) {
        // This can happen if the move is invalid, which is expected
        // when we are just converting a sequence of moves.
        // We just break and return the moves we have converted so far.
        console.error("Error converting move:", error);
        break;
      }
    }

    return convertedMoves;
  }
}
