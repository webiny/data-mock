import { EventBridge as Abstraction } from "./abstractions/EventBridge.js";
import type { IEventMap, EventHandler } from "./abstractions/EventBridge.js";

type AnyHandler = (...args: never[]) => void;

class EventBridgeImpl implements Abstraction.Interface {
  private readonly listeners = new Map<string, Set<AnyHandler>>();

  public on<K extends keyof IEventMap>(type: K, handler: EventHandler<IEventMap[K]>): () => void {
    const key = type as string;
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(handler as AnyHandler);
    return () => this.off(type, handler);
  }

  public off<K extends keyof IEventMap>(type: K, handler: EventHandler<IEventMap[K]>): void {
    const set = this.listeners.get(type as string);
    if (set) {
      set.delete(handler as AnyHandler);
    }
  }

  public emit<K extends keyof IEventMap>(type: K, data: IEventMap[K]): void {
    const set = this.listeners.get(type as string);
    if (!set) {
      return;
    }
    for (const handler of set) {
      (handler as EventHandler<IEventMap[K]>)(data);
    }
  }
}

export const EventBridge = Abstraction.createImplementation({
  implementation: EventBridgeImpl,
  dependencies: [],
});
