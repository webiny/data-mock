import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import {
  projectFileSchema,
  uploadFileBodySchema,
  syncFilesBodySchema,
  syncFilesResponseSchema,
  pullPicsumBodySchema,
  pullPicsumResponseSchema,
  localFileSchema,
  uploadLocalFileBodySchema,
  localFileUploadResultSchema,
  uploadGlobalBodySchema,
} from "../responses/files.js";
import { jobSchema } from "./jobs.js";

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

export const pullProjectFilesRoute = defineOneRoute("result", {
  method: "POST",
  path: "/api/projects/:projectId/files/pull",
  description: "Pull files from a Webiny project's file manager",
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

export const listLocalFilesRoute = defineListRoute("files", {
  path: "/api/files/local",
  description: "List local files in the global image pool with per-project upload status",
  params: z.object({}),
  item: localFileSchema,
});

export const uploadLocalFileRoute = defineOneRoute("file", {
  method: "POST",
  path: "/api/files/local/upload",
  description: "Save a dropped file to the local global image pool",
  params: z.object({}),
  body: uploadLocalFileBodySchema,
  item: localFileUploadResultSchema,
});

export const deleteLocalFileRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/files/local/:fileName",
  description: "Delete a file from the local global image pool",
  params: z.object({ fileName: z.string() }),
});

export const uploadGlobalFilesRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/files/upload-global",
  description: "Upload all unlinked global pool images to a project's Webiny file manager",
  params: z.object({ projectId: z.string() }),
  body: uploadGlobalBodySchema,
  item: jobSchema,
});
