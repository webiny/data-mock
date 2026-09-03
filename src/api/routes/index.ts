import type { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects/index.js";
import { registerTenantRoutes } from "./tenants/index.js";
import { registerModelRoutes } from "./models/index.js";
import { registerSeedingRoutes } from "./seeding/index.js";

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  await registerProjectRoutes(app);
  await registerTenantRoutes(app);
  await registerModelRoutes(app);
  await registerSeedingRoutes(app);
}
