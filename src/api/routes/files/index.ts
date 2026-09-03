import type { FastifyInstance } from "fastify";
import { listProjectFiles } from "./list/route.js";
import { uploadProjectFile } from "./upload/route.js";
import { deleteProjectFile } from "./delete/route.js";

export async function registerFileRoutes(app: FastifyInstance): Promise<void> {
  await listProjectFiles(app);
  await uploadProjectFile(app);
  await deleteProjectFile(app);
}
