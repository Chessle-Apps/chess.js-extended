import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChessEngine } from '../src/engine';

// Mock the Worker and its methods for integration tests
const postMessageMock = vi.fn();
const terminateMock = vi.fn();
const listeners = new Map<string, ((event: MessageEvent) => void)[]>();

const addEventListenerMock = vi.fn((event: string, listener: (event: MessageEvent) => void) => {
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event)!.push(listener);
});

const removeEventListenerMock = vi.fn((event: string, listener: (event: MessageEvent) => void) => {
  if (listeners.has(event)) {
    const eventListeners = listeners.get(event)!;
    const index = eventListeners.indexOf(listener);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
  }
});

function simulateWorkerMessage(data: string) {
  if (listeners.has('message')) {
    listeners.get('message')!.forEach(listener => listener({ data }));
  }
}

global.Worker = vi.fn(() => ({
  postMessage: postMessageMock,
  terminate: terminateMock,
  addEventListener: addEventListenerMock,
  removeEventListener: removeEventListenerMock,
})) as unknown as typeof Worker;

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('ChessEngine Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    listeners.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Chess.js integration', () => {
    it('should inherit chess.js functionality', () => {
      const engine = new ChessEngine();
      
      // Test basic chess.js methods
      expect(engine.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(engine.isGameOver()).toBe(false);
      expect(engine.isCheck()).toBe(false);
      
      // Make a move
      const move = engine.move('e4');
      expect(move).toBeTruthy();
      expect(move?.san).toBe('e4');
      // chess.js may use different en passant notation, so just check the important parts
      const fen = engine.fen();
      expect(fen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq');
      expect(fen).toContain('0 1');
    });

    it('should convert UCI moves to SAN correctly', () => {
      const engine = new ChessEngine();
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      const uciMoves = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
      const sanMoves = engine.convertMovesToSAN(uciMoves, startingFen);
      
      expect(sanMoves).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    });

    it('should handle invalid moves gracefully in conversion', () => {
      const engine = new ChessEngine();
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      const invalidMoves = ['e2e4', 'invalid_move', 'g1f3'];
      const sanMoves = engine.convertMovesToSAN(invalidMoves, startingFen);
      
      // Should convert valid moves until it hits an invalid one
      expect(sanMoves).toEqual(['e4']);
    });
  });

  describe('Analysis functionality', () => {
    it('should handle streaming analysis start and stop', () => {
      const engine = new ChessEngine();
      const analysisListener = vi.fn();
      
      engine.on('analysis', analysisListener);
      engine.startAnalysis();
      
      expect(global.Worker).toHaveBeenCalledTimes(1);
      expect(postMessageMock).toHaveBeenCalledWith('uci');
      
      // Simulate uciok and analysis
      simulateWorkerMessage('uciok');
      vi.advanceTimersByTime(50);
      
      expect(postMessageMock).toHaveBeenCalledWith('go infinite');
      
      // Stop analysis
      engine.stopAnalysis();
      expect(postMessageMock).toHaveBeenCalledWith('stop');
    });

    it('should prevent multiple simultaneous analyses', () => {
      const engine = new ChessEngine();
      
      engine.startAnalysis();
      
      // Try to start another analysis
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      engine.startAnalysis();
      
      expect(consoleSpy).toHaveBeenCalledWith('Engine is busy. Please stop the current analysis first.');
      consoleSpy.mockRestore();
    });

    it('should emit analysis events during streaming', async () => {
      const engine = new ChessEngine();
      const analysisListener = vi.fn();
      
      engine.on('analysis', analysisListener);
      engine.startAnalysis();
      
      simulateWorkerMessage('uciok');
      await vi.advanceTimersByTimeAsync(50);
      
      // Simulate analysis info
      simulateWorkerMessage('info depth 10 seldepth 15 multipv 1 score cp 25 pv e2e4 e7e5');
      
      expect(analysisListener).toHaveBeenCalledWith([{
        evaluation: 0.25,
        line: ['e4', 'e5']
      }]);
    });

    it('should handle different evaluation types in streaming', async () => {
      const engine = new ChessEngine();
      const analysisListener = vi.fn();
      
      // Set up a position where f7f8=Q would be valid (pawn on 7th rank with kings)
      engine.load('8/5P1k/8/8/8/8/8/7K w - - 0 1');
      
      engine.on('analysis', analysisListener);
      engine.startAnalysis();
      
      simulateWorkerMessage('uciok');
      await vi.advanceTimersByTimeAsync(50);
      
      // Test mate score with valid promotion move
      simulateWorkerMessage('info depth 10 multipv 1 score mate 3 pv f7f8q');
      
      expect(analysisListener).toHaveBeenCalledWith([{
        evaluation: 'M3',
        line: ['f8=Q']
      }]);
    });
  });

  describe('Error handling', () => {
    it('should handle worker errors gracefully', () => {
      const engine = new ChessEngine();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      engine.startAnalysis();
      
      // Simulate worker error
      const WorkerMock = global.Worker as unknown as ReturnType<typeof vi.fn>;
      const worker = WorkerMock.mock.results[0].value;
      worker.onerror(new Error('Worker failed'));
      
      expect(consoleSpy).toHaveBeenCalledWith('Stockfish worker error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should reject evaluation when engine is busy', async () => {
      const engine = new ChessEngine();
      
      engine.startAnalysis(); // Make engine busy
      
      await expect(engine.evaluatePosition()).rejects.toThrow(
        'Engine is busy. Please stop the current analysis first.'
      );
    });
  });

  describe('Event listener management', () => {
    it('should remove event listeners correctly', () => {
      const engine = new ChessEngine();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      engine.on('analysis', listener1);
      engine.on('analysis', listener2);
      engine.off('analysis', listener1);
      
      engine.startAnalysis();
      simulateWorkerMessage('uciok');
      vi.advanceTimersByTime(50);
      simulateWorkerMessage('info depth 10 multipv 1 score cp 25 pv e2e4');
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });
});