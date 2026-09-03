import type { FastifyInstance } from "fastify";
import { listProjectModels } from "./list/route.js";
import { syncProjectModels } from "./sync/route.js";
import { diffProjectModels } from "./diff/route.js";

export async function registerModelRoutes(app: FastifyInstance): Promise<void> {
  await listProjectModels(app);
  await syncProjectModels(app);
  await diffProjectModels(app);
}
