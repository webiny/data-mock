import type { FastifyInstance } from "fastify";
import { listSyncLogs } from "./list/route.js";
import { deleteSyncLog } from "./delete/route.js";

export async function registerSyncLogRoutes(app: FastifyInstance): Promise<void> {
  await listSyncLogs(app);
  await deleteSyncLog(app);
}
