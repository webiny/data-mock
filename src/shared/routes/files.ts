import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import {
  projectFileSchema,
  uploadFileBodySchema,
  syncFilesBodySchema,
  syncFilesResponseSchema,
  pullPicsumBodySchema,
  pullPicsumResponseSchema,
} from "../responses/files.js";

export const listProjectFilesRoute = defineListRoute("files", {
  path: "/api/projects/:projectId/files",
  description: "List uploaded files for a project",
  params: z.object({ projectId: z.string() }),
  item: projectFileSchema,
});

export const uploadProjectFileRoute = defineOneRoute("file", {
  method: "POST",
  path: "/api/projects/:projectId/files/upload",
  description: "Upload a file to a Webiny project",
  params: z.object({ projectId: z.string() }),
  body: uploadFileBodySchema,
  item: projectFileSchema,
});

export const deleteProjectFileRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/projects/:projectId/files/:fileId",
  description: "Remove an uploaded file reference",
  params: z.object({ projectId: z.string(), fileId: z.string() }),
});

export const syncProjectFilesRoute = defineOneRoute("result", {
  method: "POST",
  path: "/api/projects/:projectId/files/sync",
  description: "Sync files from a Webiny project's file manager",
  params: z.object({ projectId: z.string() }),
  body: syncFilesBodySchema,
  item: syncFilesResponseSchema,
});

export const pullPicsumImagesRoute = defineOneRoute("result", {
  method: "POST",
  path: "/api/files/picsum/pull",
  description: "Pull placeholder images from picsum.photos",
  params: z.object({}),
  body: pullPicsumBodySchema,
  item: pullPicsumResponseSchema,
});
