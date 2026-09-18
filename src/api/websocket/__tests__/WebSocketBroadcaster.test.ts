import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { Container } from "@webiny/di";
import {
  FastifyWebSocketBroadcaster,
  FastifyWebSocketBroadcasterToken,
} from "../WebSocketBroadcaster.js";
import type { IWebSocketConnection } from "../WebSocketBroadcaster.js";
import { WebSocketFeature } from "../feature.js";
import { websocketRoutes } from "../WebSocketPlugin.js";
import { WebSocketBroadcaster } from "~/shared/node/websocket/abstractions/WebSocketBroadcaster.js";

const OPEN = 1;
const CLOSED = 3;

/** A connection that records what it was sent, without a socket under it. */
class FakeConnection implements IWebSocketConnection {
  public readonly sent: string[] = [];
  public closed = false;
  public throwOnSend = false;

  public constructor(public readyState: number = OPEN) {}

  public send(data: string): void {
    if (this.throwOnSend) {
      throw new Error("socket is gone");
    }
    this.sent.push(data);
  }

  public close(): void {
    this.closed = true;
  }
}

const jobLog = { jobId: "job-1", projectId: "project-1", line: "Deploying core..." };

describe("FastifyWebSocketBroadcaster", () => {
  let broadcaster: FastifyWebSocketBroadcaster;

  beforeEach(() => {
    broadcaster = new FastifyWebSocketBroadcaster();
  });

  it("sends one envelope carrying the event type and its data", () => {
    const client = new FakeConnection();
    broadcaster.addClient(client);

    broadcaster.broadcast("job:log", jobLog);

    expect(client.sent).toEqual([JSON.stringify({ type: "job:log", data: jobLog })]);
  });

  it("sends to every connected client", () => {
    const first = new FakeConnection();
    const second = new FakeConnection();
    broadcaster.addClient(first);
    broadcaster.addClient(second);

    broadcaster.broadcast("job:progress", {
      jobId: "job-1",
      projectId: null,
      progress: 40,
      progressLabel: "reading",
    });

    expect(first.sent).toHaveLength(1);
    expect(second.sent).toHaveLength(1);
  });

  it("registers a connection once, however often it is added", () => {
    const client = new FakeConnection();
    broadcaster.addClient(client);
    broadcaster.addClient(client);

    broadcaster.broadcast("job:log", jobLog);

    expect(client.sent).toHaveLength(1);
  });

  it("skips a client that is not open", () => {
    const client = new FakeConnection(CLOSED);
    broadcaster.addClient(client);

    broadcaster.broadcast("job:log", jobLog);

    expect(client.sent).toEqual([]);
  });

  it("keeps broadcasting after one client's send throws", () => {
    const broken = new FakeConnection();
    broken.throwOnSend = true;
    const healthy = new FakeConnection();
    broadcaster.addClient(broken);
    broadcaster.addClient(healthy);

    broadcaster.broadcast("job:log", jobLog);

    // One dead socket must not cost every other listener the rest of the job's output.
    expect(healthy.sent).toHaveLength(1);
  });

  it("stops sending to a removed client", () => {
    const client = new FakeConnection();
    broadcaster.addClient(client);
    broadcaster.removeClient(client);

    broadcaster.broadcast("job:log", jobLog);

    expect(client.sent).toEqual([]);
  });

  it("broadcasts to nobody without failing", () => {
    expect(() => broadcaster.broadcast("job:log", jobLog)).not.toThrow();
  });

  it("is the same instance behind both of its tokens", () => {
    const container = new Container();
    WebSocketFeature.register(container);

    // The job execution context resolves the shared abstraction; the plugin resolves the concrete
    // one to add and remove clients. A second instance would broadcast into an empty set.
    expect(container.resolve(WebSocketBroadcaster)).toBe(
      container.resolve(FastifyWebSocketBroadcasterToken),
    );
  });
});

describe("websocketRoutes", () => {
  let app: FastifyInstance;
  let container: Container;
  let url: string;

  beforeEach(async () => {
    container = new Container();
    WebSocketFeature.register(container);

    app = Fastify({ logger: false });
    await app.register(websocketRoutes, { container });
    await app.listen({ port: 0, host: "127.0.0.1" });

    const address = app.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Server did not bind a port");
    }
    url = `ws://127.0.0.1:${address.port}/ws`;
  });

  afterEach(async () => {
    await app.close();
  });

  function connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolve(socket), { once: true });
      socket.addEventListener("error", () => reject(new Error("Failed to connect")), {
        once: true,
      });
    });
  }

  function nextMessage(socket: WebSocket): Promise<string> {
    return new Promise((resolve) => {
      socket.addEventListener("message", (event: MessageEvent) => resolve(String(event.data)), {
        once: true,
      });
    });
  }

  it("delivers a broadcast to a connected client", async () => {
    const socket = await connect();
    const received = nextMessage(socket);

    container.resolve(WebSocketBroadcaster).broadcast("job:log", jobLog);

    expect(JSON.parse(await received)).toEqual({ type: "job:log", data: jobLog });
    socket.close();
  });

  it("keeps serving the clients that are still connected when one disconnects", async () => {
    const leaving = await connect();
    const staying = await connect();

    const closed = new Promise<void>((resolve) => {
      leaving.addEventListener("close", () => resolve(), { once: true });
    });
    leaving.close();
    await closed;

    const received = nextMessage(staying);
    container.resolve(WebSocketBroadcaster).broadcast("job:log", jobLog);

    expect(JSON.parse(await received)).toEqual({ type: "job:log", data: jobLog });
    staying.close();
  });
});
