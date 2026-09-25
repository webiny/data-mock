import { z } from "zod";
import { defineListRoute, defineOneRoute } from "../routing/defineTypedRoutes.js";
import { projectModelSchema } from "../responses/models.js";
import { jobSchema } from "./jobs.js";

export const listProjectModelsRoute = defineListRoute("models", {
  path: "/api/projects/:projectId/environments/:environmentId/models",
  description: "List local models, every tenant's or one tenant's with `?tenant=`",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: projectModelSchema,
});

export const syncProjectModelsRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/environments/:environmentId/models/pull",
  description: "Pull models from Webiny for every tenant of an environment that has a key",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: jobSchema,
});
