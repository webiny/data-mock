import type { FastifyInstance } from "fastify";
import { listProjectEnvironments } from "./list/route.js";
import { getProjectEnvironment } from "./get/route.js";
import { createProjectEnvironment } from "./create/route.js";
import { updateProjectEnvironment } from "./update/route.js";
import { removeProjectEnvironment } from "./remove/route.js";
import { listEnvironmentStacks } from "./stacks/route.js";
import { syncProject } from "./sync/route.js";
import { healthCheckEnvironment } from "./health/route.js";

export async function registerEnvironmentRoutes(app: FastifyInstance): Promise<void> {
  await listProjectEnvironments(app);
  await getProjectEnvironment(app);
  await createProjectEnvironment(app);
  await updateProjectEnvironment(app);
  await removeProjectEnvironment(app);
  await listEnvironmentStacks(app);
  await syncProject(app);
  await healthCheckEnvironment(app);
}
