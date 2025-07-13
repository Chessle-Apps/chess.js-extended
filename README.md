# chess.js-extended

A powerful browser-only chess engine package that extends chess.js with built-in Stockfish evaluation capabilities. This package bundles Stockfish for position evaluation and analysis directly in the browser using Web Workers and WebAssembly.

## Features

- 🚀 **Built on chess.js**: All standard chess.js functionality included
- 🧠 **Stockfish Integration**: Bundled Stockfish engine for position evaluation
- 🌐 **Browser-Only**: Designed specifically for browser environments with Web Worker support
- ⚡ **WebAssembly Support**: Automatically uses WASM when available for better performance
- 🎯 **Position Evaluation**: Get numerical evaluations and mate scores
- 📈 **Multi-PV Analysis**: Get multiple principal variations for deeper insight
- 🔍 **Suggested Lines**: Get full suggested lines of play in SAN format
- ⚙️ **Flexible Options**: Configure search depth, time limits, and more
- 📦 **Multiple Formats**: CommonJS and ES Module builds included

## Installation

```bash
pnpm install @chessle/chess.js-extended
```

## Quick Start

```typescript
import { ChessEngine } from "@chessle/chess.js-extended";

const engine = new ChessEngine();

// Make some moves
engine.move("e4");
engine.move("e5");
engine.move("Nf3");

// Evaluate the position
const lines = await engine.evaluatePosition();

if (lines.length > 0) {
  const bestLine = lines[0];
  console.log(`Evaluation: ${bestLine.evaluation}`);
  console.log(`Best move: ${bestLine.line[0]}`);
  console.log(`Suggested line: ${bestLine.line.join(" ")}`);
}
```

## Dual-Mode API: Promise and Streaming

`ChessEngine` offers two distinct modes for analysis to suit different use cases: a simple **Promise-based** mode for one-shot evaluations and a powerful **Streaming API** for continuous analysis.

**Important:** A single `ChessEngine` instance can only perform one analysis at a time. Attempting to start a new evaluation or analysis while one is already in progress will result in an error.

### 1. Promise-Based Analysis (One-Shot)

The `evaluatePosition()` method is perfect for when you need a single, final evaluation of the current board state. It returns a promise that resolves once Stockfish has completed its analysis.

```typescript
import { ChessEngine } from "@chessle/chess.js-extended";

const engine = new ChessEngine();
engine.load("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");

async function getEvaluation() {
  console.log("Evaluating position...");
  const lines = await engine.evaluatePosition({ depth: 18 });
  console.log("Evaluation complete.");

  if (lines.length > 0) {
    const bestLine = lines[0];
    console.log(`Evaluation: ${bestLine.evaluation}`);
    console.log(`Best move: ${bestLine.line[0]}`);
  }
}

getEvaluation();
```

### 2. Streaming Analysis (Continuous)

The streaming API is ideal for applications that need to display real-time engine analysis, such as a live chessboard UI.

- `startAnalysis(options)`: Begins an infinite analysis of the current position.
- `on('analysis', callback)`: Listens for analysis updates. The callback receives an array of the latest `AnalysisLine` objects as the engine deepens its search.
- `stopAnalysis()`: Sends the `stop` command to Stockfish, which will then emit a final `bestmove` and terminate the analysis.

```typescript
import { ChessEngine } from "@chessle/chess.js-extended";

const engine = new ChessEngine();
engine.load("r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");

// 1. Listen for analysis updates
engine.on("analysis", (lines) => {
  console.clear();
  console.log("Current Analysis:");
  lines.forEach((line) => {
    console.log(`- ${line.line.join(" ")} (Eval: ${line.evaluation})`);
  });
});

// 2. Start the analysis
console.log("Starting continuous analysis...");
engine.startAnalysis({ multiPV: 3 });

// 3. Stop the analysis after a few seconds
setTimeout(() => {
  console.log("Stopping analysis...");
  engine.stopAnalysis();
  console.log("Analysis stopped.");
}, 5000);
```

## API Reference

### ChessEngine Class

The `ChessEngine` class extends the standard chess.js `Chess` class with evaluation capabilities.

#### Constructor

```typescript
const engine = new ChessEngine();
```

#### Properties

- `lines: AnalysisLine[]` - An array of the most recent final analysis lines from the last completed `evaluatePosition` call.

#### Methods

##### evaluatePosition(options?)

Evaluates the current position using Stockfish and returns a single result.

```typescript
await engine.evaluatePosition(options?: StockfishOptions): Promise<AnalysisLine[]>;
```

##### startAnalysis(options?)

Starts a continuous, infinite analysis of the current position. Use the `on('analysis', ...)` method to receive updates.

```typescript
engine.startAnalysis(options?: StockfishOptions): void;
```

##### stopAnalysis()

Stops a running analysis that was started with `startAnalysis()`.

```typescript
engine.stopAnalysis(): void;
```

##### on(event, listener)

Subscribes to engine events. Currently, only the `analysis` event is supported.

```typescript
engine.on('analysis', (lines: AnalysisLine[]) => void): void;
```

##### off(event, listener)

Unsubscribes from engine events.

```typescript
engine.off('analysis', (lines: AnalysisLine[]) => void): void;
```

### StockfishOptions Interface

```typescript
interface StockfishOptions {
  /** Search depth (default: 15) */
  depth?: number;
  /** Thinking time in milliseconds */
  time?: number;
  /** Exact time to think in milliseconds */
  movetime?: number;
  /** Number of nodes to search */
  nodes?: number;
  /** Number of principal variations to search for (default: 1) */
  multiPV?: number;
  /** Skill level of the engine (0-20) */
  skillLevel?: number;
  /** Contempt value for the engine (-100 to 100) */
  contempt?: number;
  /** Number of threads to use (1-512) */
  threads?: number;
  /** Hash table size in MB (1-32768) */
  hash?: number;
  /** Custom Stockfish worker URL (optional) */
  stockfishUrl?: string;
}
```

### AnalysisLine Interface

```typescript
interface AnalysisLine {
  /** The evaluation of the position (e.g., 0.5, -1.2, "M5", "M-3") */
  evaluation: number | string;
  /** The suggested sequence of moves in SAN format */
  line: string[];
}
```

## Usage Examples

### Basic Position Evaluation

```typescript
import { ChessEngine } from "chess.js-extended";

const engine = new ChessEngine();
engine.load("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");

const lines = await engine.evaluatePosition();
if (lines.length > 0) {
  console.log(`Position evaluation: ${lines[0].evaluation}`);
  // Output: Position evaluation: 0.15
}
```

### Multi-PV Analysis

Get the top 3 best moves and their evaluations.

```typescript
const lines = await engine.evaluatePosition({ multiPV: 3 });

lines.forEach((line, index) => {
  console.log(
    `Rank ${index + 1}: ${line.line.join(" ")} (Eval: ${line.evaluation})`,
  );
});
// Output:
// Rank 1: Nc6 ... (Eval: 0.15)
// Rank 2: c5 ... (Eval: 0.20)
// Rank 3: e6 ... (Eval: 0.22)
```

### Time-Limited Analysis

```typescript
// Analyze for exactly 5 seconds
const lines = await engine.evaluatePosition({ movetime: 5000 });
if (lines.length > 0) {
  console.log(`Timed evaluation: ${lines[0].evaluation}`);
}
```

### Configuring Engine Parameters

You can fine-tune the engine's performance and playing style by providing additional options.

```typescript
const lines = await engine.evaluatePosition({
  skillLevel: 10, // Set skill level to 10 (0-20)
  contempt: 20, // Set contempt to 20 (-100-100)
  threads: 4, // Use 4 threads
  hash: 128, // Use 128MB of hash memory
});

if (lines.length > 0) {
  console.log(`Evaluation with custom parameters: ${lines[0].evaluation}`);
}
```

### Getting the Best Move and Line

```typescript
const lines = await engine.evaluatePosition();

if (lines.length > 0) {
  const bestLine = lines[0];
  console.log(`Best move: ${bestLine.line[0]}`);
  engine.move(bestLine.line[0]);

  console.log(`Principal variation: ${bestLine.line.join(" ")}`);
  // Output: Principal variation: Nf3 Nc6 Bc4 Bc5
}
```

### Handling Mate Scores

```typescript
// Load a position with checkmate
engine.load("rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");

const lines = await engine.evaluatePosition();
if (lines.length > 0) {
  console.log(`Evaluation: ${lines[0].evaluation}`);
  // Output: Evaluation: M-1 (mate in 1 for black)
}
```

### Using All chess.js Methods

Since `ChessEngine` extends `Chess`, you have access to all standard chess.js functionality:

```typescript
const engine = new ChessEngine();

// Standard chess.js methods work as expected
console.log(engine.ascii());
console.log(engine.moves());
console.log(engine.inCheck());
console.log(engine.isGameOver());

// Make moves
engine.move("e4");
engine.move({ from: "e7", to: "e5" });

// Undo moves
engine.undo();

// Get FEN
console.log(engine.fen());

// And then evaluate
const lines = await engine.evaluatePosition();
```

## Browser Compatibility

This package requires:

- Web Worker support
- WebAssembly support (recommended, falls back to JavaScript if unavailable)
- Modern browser with ES6+ support

## Performance Notes

- **WebAssembly**: Automatically detected and used when available
- **Web Workers**: Stockfish runs in a separate thread to avoid blocking the main thread
- **Memory Management**: Worker instances are properly cleaned up after analysis
- **Timeout Protection**: Analysis automatically times out after 30 seconds to prevent hanging

## Error Handling

```typescript
try {
  const lines = await engine.evaluatePosition();
  if (lines.length > 0) {
    console.log(lines[0].evaluation);
  }
} catch (error) {
  if (error.message.includes("browser environment")) {
    console.log("This package only works in browsers");
  } else if (error.message.includes("worker failed")) {
    console.log("Stockfish failed to load");
  }
}
```

## Common Evaluation Values

- **Positive numbers**: Advantage for White (e.g., `+1.5` = White is ahead by 1.5 pawns)
- **Negative numbers**: Advantage for Black (e.g., `-0.8` = Black is ahead by 0.8 pawns)
- **Mate scores**: `M3` = mate in 3, `M-2` = mate in 2 for opponent
- **Zero**: Equal position

## License

GPL-3.0 - See [LICENSE](LICENSE) file for details.

## Contributing

This package is part of the Chessle project. Contributions welcome!

## Related Packages

- [chess.js](https://github.com/jhlywa/chess.js) - The core chess library this extends
- [Stockfish](https://stockfishchess.org/) - The powerful chess engine bundled within
