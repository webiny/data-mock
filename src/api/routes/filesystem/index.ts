import type { FastifyInstance } from "fastify";
import { browseDirectory } from "./browse/route.js";
import { scanForProjects } from "./scan/route.js";
import { createScanRoot, listScanRoots, removeScanRoot } from "./scanRoots/route.js";

export async function registerFileSystemRoutes(app: FastifyInstance): Promise<void> {
  await browseDirectory(app);
  await scanForProjects(app);
  await listScanRoots(app);
  await createScanRoot(app);
  await removeScanRoot(app);
}
