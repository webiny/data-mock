import type { FastifyInstance } from "fastify";
import { listProjects } from "./list/route.js";
import { getProject } from "./get/route.js";
import { createProject } from "./create/route.js";
import { archiveProject } from "./archive/route.js";
import { restoreProject } from "./restore/route.js";
import { purgeProject } from "./purge/route.js";
import { getProjectDeletionImpact } from "./impact/route.js";
import { updateProject } from "./update/route.js";

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  await listProjects(app);
  await getProject(app);
  await createProject(app);
  await updateProject(app);
  await archiveProject(app);
  await restoreProject(app);
  await purgeProject(app);
  await getProjectDeletionImpact(app);
}
