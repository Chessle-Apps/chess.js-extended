// Define the structure for a single analysis line
export interface AnalysisLine {
  evaluation: number | string;
  line: string[];
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
