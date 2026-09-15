import type { FastifyInstance } from "fastify";
import { listProjectEnvironments } from "./list/route.js";
import { getProjectEnvironment } from "./get/route.js";
import { createProjectEnvironment } from "./create/route.js";
import { updateProjectEnvironment } from "./update/route.js";
import { archiveProjectEnvironment } from "./archive/route.js";
import { restoreProjectEnvironment } from "./restore/route.js";
import { purgeProjectEnvironment } from "./purge/route.js";
import { getEnvironmentDeletionImpact } from "./impact/route.js";
import { listEnvironmentStacks } from "./stacks/route.js";
import { syncProject } from "./sync/route.js";
import { deployEnvironment } from "./deploy/route.js";
import { destroyEnvironment } from "./destroy/route.js";
import { listDeployableApps } from "./deployableApps/route.js";
import { healthCheckEnvironment } from "./health/route.js";

export async function registerEnvironmentRoutes(app: FastifyInstance): Promise<void> {
  await listProjectEnvironments(app);
  await getProjectEnvironment(app);
  await createProjectEnvironment(app);
  await updateProjectEnvironment(app);
  await archiveProjectEnvironment(app);
  await restoreProjectEnvironment(app);
  await purgeProjectEnvironment(app);
  await getEnvironmentDeletionImpact(app);
  await listEnvironmentStacks(app);
  await syncProject(app);
  await deployEnvironment(app);
  await destroyEnvironment(app);
  await listDeployableApps(app);
  await healthCheckEnvironment(app);
}
