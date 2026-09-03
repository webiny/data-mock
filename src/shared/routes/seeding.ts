import { z } from "zod";
import { defineListRoute, defineOneRoute } from "../routing/defineTypedRoutes.js";
import { seedJobSchema, triggerSeedBodySchema } from "../responses/seeding.js";

export const triggerSeedRoute = defineOneRoute("seedJob", {
  method: "POST",
  path: "/api/projects/:projectId/seed",
  description: "Trigger data seeding for a project",
  params: z.object({ projectId: z.string() }),
  body: triggerSeedBodySchema,
  item: seedJobSchema,
});

export const listSeedJobsRoute = defineListRoute("seedJobs", {
  path: "/api/projects/:projectId/seed-jobs",
  description: "List seed job history for a project",
  params: z.object({ projectId: z.string() }),
  item: seedJobSchema,
});
