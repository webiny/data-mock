import { WebSocketListener as Abstraction } from "./abstractions/WebSocketListener.js";
import { EventBridge } from "../events/abstractions/EventBridge.js";
import type { IEventMap } from "../events/abstractions/EventBridge.js";
import "~/ui/infrastructure/events/eventMap.js";

const RECONNECT_BASE_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 3;

class WebSocketListenerImpl implements Abstraction.Interface {
  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private intentionalClose = false;

  public constructor(private readonly eventBridge: EventBridge.Interface) {}

  public connect(): void {
    this.intentionalClose = false;
    this.openConnection();
  }

  public disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private openConnection(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      if (this.reconnectAttempt > 0) {
        this.eventBridge.emit("ws:reconnected", undefined);
      }
      this.reconnectAttempt = 0;
    };

    this.socket.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data as string);
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private handleMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as { type: string; data: unknown };
      if (typeof parsed.type !== "string") {
        return;
      }
      this.eventBridge.emit(
        parsed.type as keyof IEventMap,
        parsed.data as IEventMap[keyof IEventMap],
      );
    } catch {
      // ignore malformed messages
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }
    const delay = RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.openConnection();
    }, delay);
  }
}

export const WebSocketListener = Abstraction.createImplementation({
  implementation: WebSocketListenerImpl,
  dependencies: [EventBridge],
});
