import type { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects/index.js";
import { registerTenantRoutes } from "./tenants/index.js";

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  await registerProjectRoutes(app);
  await registerTenantRoutes(app);
}
