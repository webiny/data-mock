import { z } from "zod";
import { defineOneRoute } from "../routing/defineTypedRoutes.js";
import { jobSchema } from "./jobs.js";

export const cleanupEntriesRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/cleanup",
  description: "Delete seeded entries from Webiny for a project",
  params: z.object({ projectId: z.string() }),
  body: z.object({ jobId: z.string().optional() }).optional(),
  item: jobSchema,
});
