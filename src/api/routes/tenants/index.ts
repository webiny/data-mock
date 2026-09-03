import type { FastifyInstance } from "fastify";
import { listProjectTenants } from "./list/route.js";
import { syncProjectTenants } from "./sync/route.js";

export async function registerTenantRoutes(app: FastifyInstance): Promise<void> {
  await listProjectTenants(app);
  await syncProjectTenants(app);
}
