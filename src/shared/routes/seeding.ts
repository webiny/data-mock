import { z } from "zod";
import { defineListRoute, defineOneRoute } from "../routing/defineTypedRoutes.js";
import { seedJobSchema, triggerSeedBodySchema } from "../responses/seeding.js";
import { jobSchema } from "./jobs.js";

export const triggerSeedRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/seed",
  description: "Trigger data seeding for a project",
  params: z.object({ projectId: z.string() }),
  body: triggerSeedBodySchema,
  item: jobSchema,
});

export const listSeedJobsRoute = defineListRoute("seedJobs", {
  path: "/api/projects/:projectId/seed-jobs",
  description: "List seed job history for a project",
  params: z.object({ projectId: z.string() }),
  item: seedJobSchema,
});
