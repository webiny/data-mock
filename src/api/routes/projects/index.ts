import type { FastifyInstance } from "fastify";
import { listProjectsRoute } from "./list/route.js";
import { getProjectRoute } from "./get/route.js";
import { createProjectRoute } from "./create/route.js";
import { removeProjectRoute } from "./remove/route.js";

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  await listProjectsRoute(app);
  await getProjectRoute(app);
  await createProjectRoute(app);
  await removeProjectRoute(app);
}
