# WebSocket + Notification System — Discovery

Sources:
- `/Users/brunozoric/private/dependency-upgrader` (WebSocket + EventBridge)
- reference project (Notification abstractions)

## dependency-upgrader: WebSocket + EventBridge

### Server-Side

Three files:

**`src/api/websocket/WebSocketPlugin.ts`**
- Fastify plugin using `@fastify/websocket`
- Registers `GET /ws` route
- Authenticates via `?token=` query param
- Registers connection with the broadcaster

**`src/api/websocket/WebSocketBroadcaster.ts`**
- DI singleton
- Holds `Map<Connection, userId>`
- `broadcast(type, data)` — sends `JSON.stringify({ type, data })` to all open connections
- `closeConnectionsForUser()` for cleanup

**`src/shared/websocket/types.ts`**
- Shared `WSEventMap` type mapping event names to payload shapes
- Example: `"job:status" → WSJobStatus`, `"job:log" → WSJobLog`
- Used by both server and UI for type safety

### UI-Side

Three files:

**`src/ui/infrastructure/WebSocket/WebSocketListener.ts`**
- DI singleton
- `connect()` opens `ws://host/ws?token=`
- On message: Zod-validates `{ type, data }`, then emits onto EventBridge
- Auto-reconnects with exponential backoff (1s base, 3 steps max)

**`src/ui/infrastructure/Events/EventBridge.ts`**
- DI singleton
- Simple `on/off/emit` with `Map<string, Set<handler>>`
- Source-agnostic — doesn't know about WebSocket
- Any producer can emit, any consumer can listen

**`src/ui/infrastructure/Events/eventMap.ts`**
- Declaration merging: augments `IEventMap` interface with WS event types + `ws:reconnected`
- Type-safe without coupling EventBridge to WebSocket

### Event Flow

```
Server action (e.g., job progress update)
  → broadcaster.broadcast("job:status", data)
  → WebSocket to all connected clients
  → WebSocketListener.handleMessage()
  → eventBridge.emit("job:status", data)
  → any UI subscriber via eventBridge.on("job:status", handler)
```

EventBridge is the key abstraction — WebSocket is just one producer. UI actions, timers, or any other source can also emit events.

## reference project: Notification System

No WebSocket — uses notification abstractions only.

**Two DI abstractions:**
- `IErrorNotifier { notify(notification: { title, message, color? }) }`
- `ISuccessNotifier { show(message) }`

Both implemented with `@mantine/notifications` (`notifications.show()`).

**Usage pattern:** `FetchHTTPClient` injects `ErrorNotifier` and calls `notify()` on HTTP errors. Use cases inject it directly for domain-level notifications. The abstraction decouples "what to notify" from "how to show it."

## What webiny-mock-data Already Has

- `NotificationService` — success/error/warning methods using Mantine notifications
- No WebSocket
- No EventBridge

## Architecture for webiny-mock-data

### Shared Layer (`src/shared/`)

```
shared/
  websocket/
    types.ts          # WSEventMap — shared event name → payload type
```

### API Layer (`src/api/`)

```
api/
  websocket/
    WebSocketPlugin.ts       # @fastify/websocket, GET /ws route
    WebSocketBroadcaster.ts  # DI singleton, broadcast(type, data)
```

No auth needed (localhost-only tool).

### UI Layer (`src/ui/`)

```
ui/
  infrastructure/
    events/
      EventBridge.ts    # DI singleton, on/off/emit
      eventMap.ts       # Declaration merging for type-safe events
    websocket/
      WebSocketListener.ts  # connect, validate, emit to EventBridge
```

### Event Types for Jobs

```ts
interface WSEventMap {
  "job:status": { jobId: string; status: string; type: string };
  "job:progress": { jobId: string; progress: number; label: string };
  "job:log": { jobId: string; line: string };
}
```

### Integration Points

- JobWorker calls `broadcaster.broadcast("job:status", ...)` on status transitions
- JobExecutionContext calls `broadcaster.broadcast("job:progress", ...)` and `broadcaster.broadcast("job:log", ...)` on progress/log updates
- UI presenters subscribe to EventBridge events to update job status in real-time
- Existing NotificationService remains for toast notifications (success/error)
- EventBridge can also emit local events (e.g., `"sync:complete"` after a sync finishes)
