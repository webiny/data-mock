import type { FastifyInstance } from "fastify";
import { cleanupEntries } from "./route.js";

export async function registerCleanupRoutes(app: FastifyInstance): Promise<void> {
  await cleanupEntries(app);
}
