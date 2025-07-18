import { describe, it, expect } from "vitest";
import type { AnalysisLine, StockfishOptions } from "../src/types";

describe("Types", () => {
  describe("AnalysisLine", () => {
    it("should allow numeric evaluation", () => {
      const line: AnalysisLine = {
        evaluation: 0.5,
        line: ["e4", "e5", "Nf3"],
      };

      expect(typeof line.evaluation).toBe("number");
      expect(Array.isArray(line.line)).toBe(true);
    });

    it("should allow string evaluation (mate scores)", () => {
      const line: AnalysisLine = {
        evaluation: "M5",
        line: ["Qh8+", "Kf7", "Qh7#"],
      };

      expect(typeof line.evaluation).toBe("string");
      expect(line.evaluation).toBe("M5");
    });

    it("should allow negative mate scores", () => {
      const line: AnalysisLine = {
        evaluation: "M-3",
        line: ["Kh1", "Qh2#"],
      };

      expect(line.evaluation).toBe("M-3");
    });
  });

  describe("StockfishOptions", () => {
    it("should work with empty options", () => {
      const options: StockfishOptions = {};
      expect(options).toEqual({});
    });

    it("should support all option types", () => {
      const options: StockfishOptions = {
        depth: 20,
        time: 5000,
        movetime: 1000,
        nodes: 1000000,
        stockfishUrl: "custom-stockfish.js",
        multiPV: 3,
        skillLevel: 15,
        contempt: 24,
        threads: 4,
        hash: 512,
      };

      expect(options.depth).toBe(20);
      expect(options.time).toBe(5000);
      expect(options.movetime).toBe(1000);
      expect(options.nodes).toBe(1000000);
      expect(options.stockfishUrl).toBe("custom-stockfish.js");
      expect(options.multiPV).toBe(3);
      expect(options.skillLevel).toBe(15);
      expect(options.contempt).toBe(24);
      expect(options.threads).toBe(4);
      expect(options.hash).toBe(512);
    });

    it("should support partial options", () => {
      const options: StockfishOptions = {
        depth: 15,
        multiPV: 2,
      };

      expect(options.depth).toBe(15);
      expect(options.multiPV).toBe(2);
      expect(options.time).toBeUndefined();
    });
  });
});
