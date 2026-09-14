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
import { SyncScheduler } from "~/shared/node/features/webinyCli/schedule/abstractions/SyncScheduler.js";

const PORT = Number(process.env.API_PORT ?? 4000);
const HOST = "127.0.0.1";
const JOB_POLL_INTERVAL_MS = 3000;
/**
 * A checkout's version, environments and stack output only change when someone deploys, destroys
 * or pulls, so a daily pass is enough to keep an untouched machine current. The boot sync covers
 * everything that changed while the server was down.
 */
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
/**
 * Boot sync is delayed so it queues behind the first job poll rather than competing with the
 * server's own startup.
 */
const BOOT_SYNC_DELAY_MS = 5000;

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

/**
 * The scheduler enqueues; it never syncs. A sync that ran here directly could read a checkpoint
 * a deploy is halfway through rewriting — see SyncScheduler.
 */
const syncScheduler = container.resolve(SyncScheduler);
const runScheduledSync = (): void => {
  syncScheduler.execute().catch((err) => {
    logger.error("Scheduled sync failed to enqueue", { error: String(err) });
  });
};

const bootSyncTimer = setTimeout(runScheduledSync, BOOT_SYNC_DELAY_MS);
const syncTimer = setInterval(runScheduledSync, SYNC_INTERVAL_MS);

let shuttingDown = false;
const shutdown = async (): Promise<void> => {
  if (shuttingDown) {
    logger.info("Force shutdown.");
    process.exit(1);
  }
  shuttingDown = true;
  logger.info("Shutting down...");
  clearInterval(pollTimer);
  clearTimeout(bootSyncTimer);
  clearInterval(syncTimer);
  await jobWorker.drain();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ port: PORT, host: HOST });
console.log(`API server running on http://${HOST}:${PORT}`);
