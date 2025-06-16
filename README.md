# chess.js-extended

A powerful browser-only chess engine package that extends chess.js with built-in Stockfish evaluation capabilities. This package bundles Stockfish for position evaluation and analysis directly in the browser using Web Workers and WebAssembly.

## Features

- 🚀 **Built on chess.js**: All standard chess.js functionality included
- 🧠 **Stockfish Integration**: Bundled Stockfish engine for position evaluation
- 🌐 **Browser-Only**: Designed specifically for browser environments with Web Worker support
- ⚡ **WebAssembly Support**: Automatically uses WASM when available for better performance
- 🎯 **Position Evaluation**: Get numerical evaluations and mate scores
- 📈 **Best Move Suggestions**: Find the best move for any position
- 🔍 **Principal Variation**: Get the suggested line of play
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
const result = await engine.evaluatePosition();
console.log(`Evaluation: ${result.evaluation}`);
console.log(`Best move: ${result.bestMove}`);
console.log(`Suggested line: ${result.suggestedLine.join(" ")}`);
```

## API Reference

### ChessEngine Class

The `ChessEngine` class extends the standard chess.js `Chess` class with evaluation capabilities.

#### Constructor

```typescript
const engine = new ChessEngine();
```

#### Properties

- `evaluation: number | string` - Current position evaluation
- `bestMove: string | undefined` - Best move in UCI notation
- `suggestedLine: string[]` - Principal variation in SAN notation

#### Methods

##### evaluatePosition(options?)

Evaluates the current position using Stockfish.

```typescript
await engine.evaluatePosition(options?: StockfishOptions)
```

**Parameters:**

- `options` (optional): Configuration object for the evaluation

**Returns:**

```typescript
Promise<{
  evaluation: number | string;
  bestMove: string | undefined;
  suggestedLine: string[];
}>;
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
  /** Custom Stockfish worker URL (optional) */
  stockfishUrl?: string;
}
```

## Usage Examples

### Basic Position Evaluation

```typescript
import { ChessEngine } from "chess.js-extended";

const engine = new ChessEngine();
engine.load("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");

const result = await engine.evaluatePosition();
console.log(`Position evaluation: ${result.evaluation}`);
// Output: Position evaluation: 0.15
```

### Custom Search Depth

```typescript
const result = await engine.evaluatePosition({ depth: 20 });
console.log(`Deep evaluation: ${result.evaluation}`);
```

### Time-Limited Analysis

```typescript
// Analyze for exactly 5 seconds
const result = await engine.evaluatePosition({ movetime: 5000 });
console.log(`Timed evaluation: ${result.evaluation}`);
```

### Getting the Best Move and Line

```typescript
const result = await engine.evaluatePosition();

if (result.bestMove) {
  console.log(`Best move: ${result.bestMove}`);
  engine.move(result.bestMove);
}

console.log(`Principal variation: ${result.suggestedLine.join(" ")}`);
// Output: Principal variation: Nf3 Nc6 Bc4 Bc5
```

### Handling Mate Scores

```typescript
// Load a position with checkmate
engine.load("rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");

const result = await engine.evaluatePosition();
console.log(`Evaluation: ${result.evaluation}`);
// Output: Evaluation: M-1 (mate in 1 for black)
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
const evaluation = await engine.evaluatePosition();
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
  const result = await engine.evaluatePosition();
  console.log(result.evaluation);
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
