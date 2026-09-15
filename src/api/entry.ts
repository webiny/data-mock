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
import { ChildProcessTracker } from "~/shared/node/features/childProcesses/abstractions/ChildProcessTracker.js";

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

/**
 * Kill before marking. A `webiny deploy` outlives the server that started it — the child has its
 * own process group — so a restart mid-deploy leaves pulumi running against the stack while the
 * job row says nothing is happening. Reaping first means the row is accurate by the time it is
 * written, and no unowned process is still writing to a stack this server is about to report on.
 */
const childProcessTracker = container.resolve(ChildProcessTracker);
const reaped = await childProcessTracker.reapOrphans();
if (reaped.killed > 0) {
  logger.warn(`Killed ${reaped.killed} orphaned child process(es) left by a previous run.`);
}

await jobWorker.recoverStaleJobs();

const pollTimer = setInterval(() => {
  jobWorker.processNextJob().catch((err) => {
    logger.error("Job poll failed", { error: String(err) });
  });
}, JOB_POLL_INTERVAL_MS);

/**
 * Nothing syncs on its own. A sync rewrites the version, environments and stack output stored for
 * a project from whatever is on disk, which is not something to do behind the user's back: it is
 * started from the Sync from disk button, which shows the diff first.
 */

let shuttingDown = false;
const shutdown = async (): Promise<void> => {
  if (shuttingDown) {
    logger.info("Force shutdown.");
    process.exit(1);
  }
  shuttingDown = true;
  logger.info("Shutting down...");
  clearInterval(pollTimer);
  /**
   * Terminate before draining. The children are detached, so they no longer die with this process,
   * and a running deploy would hold `drain()` for the tens of minutes it takes to finish.
   */
  await childProcessTracker.terminateAll();
  await jobWorker.drain();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ port: PORT, host: HOST });
console.log(`API server running on http://${HOST}:${PORT}`);
