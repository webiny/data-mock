import { createAbstraction } from "@webiny/stdlib";

export interface IWebSocketListener {
  connect(): void;
  disconnect(): void;
}

export const WebSocketListener = createAbstraction<IWebSocketListener>("Ui/WebSocketListener");

export namespace WebSocketListener {
  export type Interface = IWebSocketListener;
}
