import { z } from "zod";
import { defineListRoute, defineOneRoute } from "../routing/defineTypedRoutes.js";
import {
  projectModelSchema,
  modelDiffItemSchema,
  modelSyncResultSchema,
} from "../responses/models.js";

export const listProjectModelsRoute = defineListRoute("models", {
  path: "/api/projects/:projectId/models",
  description: "List local models for a project",
  params: z.object({ projectId: z.string() }),
  item: projectModelSchema,
});

export const syncProjectModelsRoute = defineOneRoute("sync", {
  method: "POST",
  path: "/api/projects/:projectId/models/sync",
  description: "Sync models from Webiny for a project",
  params: z.object({ projectId: z.string() }),
  item: modelSyncResultSchema,
});

export const diffProjectModelsRoute = defineListRoute("diff", {
  path: "/api/projects/:projectId/models/diff",
  description: "Compare local vs remote models for a project",
  params: z.object({ projectId: z.string() }),
  item: modelDiffItemSchema,
});
