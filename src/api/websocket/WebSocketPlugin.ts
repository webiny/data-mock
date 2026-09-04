import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import fastifyWebsocket from "@fastify/websocket";
import { FastifyWebSocketBroadcasterToken } from "./WebSocketBroadcaster.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

export async function websocketRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;
  const broadcaster = container.resolve(FastifyWebSocketBroadcasterToken);

  await app.register(fastifyWebsocket);

  app.get("/ws", { websocket: true }, (socket) => {
    broadcaster.addClient(socket);
    socket.on("close", () => {
      broadcaster.removeClient(socket);
    });
    socket.on("error", () => {
      broadcaster.removeClient(socket);
    });
  });
}
