import type { FastifyInstance } from "fastify";
import { listProjects } from "./list/route.js";
import { getProject } from "./get/route.js";
import { createProject } from "./create/route.js";
import { removeProject } from "./remove/route.js";
import { updateProject } from "./update/route.js";

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  await listProjects(app);
  await getProject(app);
  await createProject(app);
  await updateProject(app);
  await removeProject(app);
}
