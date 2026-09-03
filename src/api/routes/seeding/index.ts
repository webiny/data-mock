import type { FastifyInstance } from "fastify";
import { triggerSeed } from "./trigger/route.js";
import { listSeedJobs } from "./history/route.js";

export async function registerSeedingRoutes(app: FastifyInstance): Promise<void> {
  await triggerSeed(app);
  await listSeedJobs(app);
}
