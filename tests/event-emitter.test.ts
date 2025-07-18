import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "../src/event-emitter";

describe("EventEmitter", () => {
  it("should create an instance", () => {
    const emitter = new EventEmitter<string>();
    expect(emitter).toBeInstanceOf(EventEmitter);
  });

  it("should add and call event listeners", () => {
    const emitter = new EventEmitter<string>();
    const listener = vi.fn();

    emitter.on("test", listener);
    emitter.emit("test", "hello");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("hello");
  });

  it("should support multiple listeners for the same event", () => {
    const emitter = new EventEmitter<string>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on("test", listener1);
    emitter.on("test", listener2);
    emitter.emit("test", "hello");

    expect(listener1).toHaveBeenCalledWith("hello");
    expect(listener2).toHaveBeenCalledWith("hello");
  });

  it("should remove listeners", () => {
    const emitter = new EventEmitter<string>();
    const listener = vi.fn();

    emitter.on("test", listener);
    emitter.off("test", listener);
    emitter.emit("test", "hello");

    expect(listener).not.toHaveBeenCalled();
  });

  it("should handle removing non-existent listeners gracefully", () => {
    const emitter = new EventEmitter<string>();
    const listener = vi.fn();

    // Should not throw when trying to remove a listener that was never added
    expect(() => emitter.off("nonexistent", listener)).not.toThrow();
  });

  it("should handle emitting to non-existent events gracefully", () => {
    const emitter = new EventEmitter<string>();

    // Should not throw when emitting to an event with no listeners
    expect(() => emitter.emit("nonexistent", "data")).not.toThrow();
  });

  it("should work with different data types", () => {
    const numberEmitter = new EventEmitter<number>();
    const objectEmitter = new EventEmitter<{ value: string }>();

    const numberListener = vi.fn();
    const objectListener = vi.fn();

    numberEmitter.on("number", numberListener);
    objectEmitter.on("object", objectListener);

    numberEmitter.emit("number", 42);
    objectEmitter.emit("object", { value: "test" });

    expect(numberListener).toHaveBeenCalledWith(42);
    expect(objectListener).toHaveBeenCalledWith({ value: "test" });
  });
});
