// A simple EventEmitter class
export class EventEmitter<T> {
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
