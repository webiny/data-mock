import { z } from "zod";
import { defineListRoute, defineOneRoute } from "../routing/defineTypedRoutes.js";
import { seedJobSchema, triggerSeedBodySchema } from "../responses/seeding.js";
import { jobSchema } from "./jobs.js";

export const triggerSeedRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/environments/:environmentId/seed",
  description: "Trigger data seeding for a project",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  body: triggerSeedBodySchema,
  item: jobSchema,
});

/**
 * Starts what is left of a seed run that stopped early. The remainder is worked out server-side
 * from the run's own config and the entries it actually created, so the caller names only the run.
 */
export const resumeSeedRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/environments/:environmentId/seed-jobs/:seedJobId/resume",
  description: "Seed whatever a cancelled or failed run did not finish",
  params: z.object({
    projectId: z.string(),
    environmentId: z.string(),
    seedJobId: z.string(),
  }),
  item: jobSchema,
});

export const listSeedJobsRoute = defineListRoute("seedJobs", {
  path: "/api/projects/:projectId/environments/:environmentId/seed-jobs",
  description: "List seed job history for a project",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: seedJobSchema,
});
