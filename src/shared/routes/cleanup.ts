import { z } from "zod";
import { defineOneRoute } from "../routing/defineTypedRoutes.js";

export const cleanupEntriesRoute = defineOneRoute("cleanup", {
  method: "POST",
  path: "/api/projects/:projectId/cleanup",
  description: "Delete seeded entries from Webiny for a project",
  params: z.object({ projectId: z.string() }),
  body: z.object({ jobId: z.string().optional() }).optional(),
  item: z.object({
    deleted: z.number(),
    errors: z.number(),
    models: z.array(
      z.object({
        modelId: z.string(),
        deleted: z.number(),
        errors: z.number(),
      }),
    ),
  }),
});
