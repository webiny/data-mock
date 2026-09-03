import type { FastifyInstance } from "fastify";
import { listSyncLogs } from "./list/route.js";

export async function registerSyncLogRoutes(app: FastifyInstance): Promise<void> {
  await listSyncLogs(app);
}
