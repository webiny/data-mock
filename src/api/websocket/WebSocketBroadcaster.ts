import { createAbstraction } from "@webiny/stdlib";
import type { WSEventMap, WSEventType } from "~/shared/websocket/types.js";
import type { WebSocketBroadcaster } from "~/shared/node/websocket/abstractions/WebSocketBroadcaster.js";

export interface IWebSocketConnection {
  readyState: number;
  send(data: string): void;
  close(): void;
}

const READY_STATE_OPEN = 1;

export class FastifyWebSocketBroadcaster implements WebSocketBroadcaster.Interface {
  private readonly clients = new Set<IWebSocketConnection>();

  public broadcast<T extends WSEventType>(type: T, data: WSEventMap[T]): void {
    const payload = JSON.stringify({ type, data });
    for (const client of this.clients) {
      if (client.readyState !== READY_STATE_OPEN) {
        continue;
      }
      try {
        client.send(payload);
      } catch {
        // ignore per-client send errors
      }
    }
  }

  public addClient(connection: IWebSocketConnection): void {
    this.clients.add(connection);
  }

  public removeClient(connection: IWebSocketConnection): void {
    this.clients.delete(connection);
  }
}

export const FastifyWebSocketBroadcasterToken = createAbstraction<FastifyWebSocketBroadcaster>(
  "Api/FastifyWebSocketBroadcaster",
);
