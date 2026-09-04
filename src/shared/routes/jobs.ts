import { z } from "zod";
import { defineListRoute, defineOneRoute } from "~/shared/routing/defineTypedRoutes.js";

const jobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.string(),
  status: z.string(),
  config: z.unknown().nullable(),
  logs: z.string().nullable(),
  progress: z.number().nullable(),
  progressLabel: z.string().nullable(),
  parentJobId: z.string().nullable(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  createdAt: z.number(),
});

const enqueueJobBodySchema = z.object({
  type: z.enum(["seed", "sync-tenants", "sync-models", "cleanup", "import"]),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const listJobsRoute = defineListRoute("jobs", {
  path: "/api/projects/:projectId/jobs",
  description: "List jobs for a project",
  params: z.object({ projectId: z.string() }),
  item: jobSchema,
});

export const getJobRoute = defineOneRoute("job", {
  path: "/api/projects/:projectId/jobs/:jobId",
  description: "Get a single job",
  params: z.object({ projectId: z.string(), jobId: z.string() }),
  item: jobSchema,
});

export const enqueueJobRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/jobs",
  description: "Enqueue a new job",
  params: z.object({ projectId: z.string() }),
  body: enqueueJobBodySchema,
  item: jobSchema,
});

export const cancelJobRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/jobs/:jobId/cancel",
  description: "Cancel a running or pending job",
  params: z.object({ projectId: z.string(), jobId: z.string() }),
  item: jobSchema,
});
