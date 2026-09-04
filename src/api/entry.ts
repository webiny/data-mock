import "dotenv/config";
import { Container } from "@webiny/di";
import { Logger } from "@webiny/stdlib";
import { AppFeature } from "~/shared/node/feature.js";
import { ApiFeature } from "./feature.js";
import { WebSocketFeature } from "./websocket/feature.js";
import { websocketRoutes } from "./websocket/WebSocketPlugin.js";
import { createServer } from "./server.js";
import { registerApiRoutes } from "./routes/index.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";

const PORT = Number(process.env.API_PORT ?? 4000);
const HOST = "127.0.0.1";
const JOB_POLL_INTERVAL_MS = 3000;

const container = new Container();
AppFeature.register(container);
WebSocketFeature.register(container);
ApiFeature.register(container);

const app = await createServer(container, [registerApiRoutes]);

await app.register(websocketRoutes, { container });

const jobWorker = container.resolve(JobWorker);
const logger = container.resolve(Logger);
await jobWorker.recoverStaleJobs();

const pollTimer = setInterval(() => {
  jobWorker.processNextJob().catch((err) => {
    logger.error("Job poll failed", { error: String(err) });
  });
}, JOB_POLL_INTERVAL_MS);

let shuttingDown = false;
const shutdown = async (): Promise<void> => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearInterval(pollTimer);
  await jobWorker.drain();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ port: PORT, host: HOST });
console.log(`API server running on http://${HOST}:${PORT}`);
