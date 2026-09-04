import type { FastifyInstance } from "fastify";
import { listProjectFiles } from "./list/route.js";
import { uploadProjectFile } from "./upload/route.js";
import { deleteProjectFile } from "./delete/route.js";
import { syncProjectFiles } from "./sync/route.js";
import { pullPicsumImages } from "./picsum/route.js";
import { listLocalFiles } from "./local/list/route.js";
import { serveLocalFileContent } from "./local/content/route.js";
import { uploadLocalFile } from "./local/upload/route.js";
import { deleteLocalFile } from "./local/delete/route.js";
import { uploadGlobalFiles } from "./uploadGlobal/route.js";

export async function registerFileRoutes(app: FastifyInstance): Promise<void> {
  await listProjectFiles(app);
  await uploadProjectFile(app);
  await deleteProjectFile(app);
  await syncProjectFiles(app);
  await pullPicsumImages(app);
  await listLocalFiles(app);
  await serveLocalFileContent(app);
  await uploadLocalFile(app);
  await deleteLocalFile(app);
  await uploadGlobalFiles(app);
}
