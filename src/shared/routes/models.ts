import { z } from "zod";
import { defineListRoute, defineOneRoute } from "../routing/defineTypedRoutes.js";
import { projectModelSchema } from "../responses/models.js";
import { jobSchema } from "./jobs.js";

export const listProjectModelsRoute = defineListRoute("models", {
  path: "/api/projects/:projectId/models",
  description: "List local models for a project",
  params: z.object({ projectId: z.string() }),
  item: projectModelSchema,
});

export const syncProjectModelsRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/models/sync",
  description: "Sync models from Webiny for a project",
  params: z.object({ projectId: z.string() }),
  item: jobSchema,
});
