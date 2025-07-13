import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChessEngine } from '../src/engine';

// Mock the Worker and its methods
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

// Helper to simulate a message from the worker
function simulateWorkerMessage(data: string) {
    if (listeners.has('message')) {
        // The engine adds two listeners, we need to call both
        listeners.get('message')!.forEach(listener => listener({ data }));
    }
}

global.Worker = vi.fn(() => ({
  postMessage: postMessageMock,
  terminate: terminateMock,
  addEventListener: addEventListenerMock,
  removeEventListener: removeEventListenerMock,
})) as unknown as typeof Worker;

// Mock URL.createObjectURL as it is used to create the worker
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('ChessEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    listeners.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize correctly', () => {
    const engine = new ChessEngine();
    expect(engine).toBeInstanceOf(ChessEngine);
  });

  it('should correctly sequence UCI commands and resolve on bestmove', async () => {
    const engine = new ChessEngine();
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const evaluationPromise = engine.evaluatePosition(fen);

    expect(global.Worker).toHaveBeenCalledTimes(1);
    expect(postMessageMock).toHaveBeenCalledWith('uci');

    // Simulate 'uciok' which triggers the setTimeout loop in checkUciOk
    simulateWorkerMessage('uciok');

    // Advance timers by 50ms to fire the pending checkUciOk
    await vi.advanceTimersByTimeAsync(50);

    // Now the position and go commands should have been sent
    expect(postMessageMock).toHaveBeenCalledWith(`position fen ${fen}`);
    expect(postMessageMock).toHaveBeenCalledWith('go depth 15');

    // Simulate the analysis info and the final bestmove
    simulateWorkerMessage('info depth 15 seldepth 22 multipv 1 score cp 13 nodes 48622 nps 151943 hashfull 999 tbhits 0 time 32 pv e2e4 e7e5 g1f3');
    simulateWorkerMessage('bestmove e2e4 ponder e7e5');

    // The promise should now resolve with the parsed analysis
    const result = await evaluationPromise;

    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(result[0].evaluation).toBe(0.13);
    expect(result[0].line).toEqual(['e4', 'e5', 'Nf3']);

    // The engine should clean up after itself
    expect(postMessageMock).toHaveBeenCalledWith('quit');
    expect(terminateMock).toHaveBeenCalledTimes(1);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should handle Multi-PV analysis', async () => {
    const engine = new ChessEngine();

    const evaluationPromise = engine.evaluatePosition({ multiPV: 3 });

    // First uci command
    expect(postMessageMock).toHaveBeenCalledWith('uci');
    
    simulateWorkerMessage('uciok');
    await vi.advanceTimersByTimeAsync(50);

    // After uciok, options should be set
    expect(postMessageMock).toHaveBeenCalledWith('setoption name MultiPV value 3');

    simulateWorkerMessage('info depth 15 seldepth 22 multipv 1 score cp 13 pv e2e4 e7e5');
    simulateWorkerMessage('info depth 15 seldepth 22 multipv 2 score cp 20 pv d2d4 d7d5');
    simulateWorkerMessage('info depth 15 seldepth 22 multipv 3 score cp 25 pv c2c4 c7c5');
    simulateWorkerMessage('bestmove e2e4 ponder e7e5');

    const result = await evaluationPromise;

    expect(result.length).toBe(3);
    expect(result[0].line).toEqual(['e4', 'e5']);
    expect(result[1].line).toEqual(['d4', 'd5']);
    expect(result[2].line).toEqual(['c4', 'c5']);
  });

  it('should handle UCI engine parameters', async () => {
    const engine = new ChessEngine();

    const evaluationPromise = engine.evaluatePosition({
      skillLevel: 10,
      contempt: 50,
      threads: 4,
      hash: 256,
    });

    // First uci command
    expect(postMessageMock).toHaveBeenCalledWith('uci');
    
    simulateWorkerMessage('uciok');
    await vi.advanceTimersByTimeAsync(50);

    // After uciok, options should be set
    expect(postMessageMock).toHaveBeenCalledWith('setoption name Skill Level value 10');
    expect(postMessageMock).toHaveBeenCalledWith('setoption name Contempt value 50');
    expect(postMessageMock).toHaveBeenCalledWith('setoption name Threads value 4');
    expect(postMessageMock).toHaveBeenCalledWith('setoption name Hash value 256');

    simulateWorkerMessage('info depth 15 seldepth 22 multipv 1 score cp 13 pv e2e4 e7e5');
    simulateWorkerMessage('bestmove e2e4 ponder e7e5');

    const result = await evaluationPromise;

    expect(result.length).toBe(1);
    expect(result[0].evaluation).toBe(0.13);
  });
});