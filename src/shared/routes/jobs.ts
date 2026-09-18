import { z } from "zod";
import { defineListRoute, defineOneRoute } from "~/shared/routing/defineTypedRoutes.js";
import { ENQUEUEABLE_JOB_TYPES } from "~/shared/jobs/descriptors.js";

export const jobSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  environmentId: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  config: z.unknown().nullable(),
  logs: z.string().nullable(),
  result: z.unknown().nullable(),
  progress: z.number().nullable(),
  progressLabel: z.string().nullable(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  createdAt: z.number(),
});

/**
 * Derived from the descriptor table's `enqueueable` flag rather than hand-listed. The per-type
 * `configSchema` is applied in the route handler — this endpoint's `config` is otherwise an
 * unvalidated record, which would let a destructive type be started without its confirmation flow.
 */
const enqueueJobBodySchema = z.object({
  type: z.enum(ENQUEUEABLE_JOB_TYPES as [string, ...string[]]),
  config: z.record(z.string(), z.unknown()).optional(),
});

/**
 * A job as a list returns it. The log is left out on purpose: a deploy streams thousands of
 * Pulumi lines into it, and a page of rows would carry all of them to render a table that shows
 * none. The log comes from `getJobRoute`, one job at a time.
 */
export const jobSummarySchema = jobSchema.omit({ logs: true });

export const listJobsRoute = defineListRoute("jobs", {
  path: "/api/projects/:projectId/jobs",
  description: "List jobs for a project",
  params: z.object({ projectId: z.string() }),
  item: jobSummarySchema,
});

export const listGlobalJobsRoute = defineListRoute("jobs", {
  path: "/api/jobs",
  description: "List all jobs (global, not project-scoped)",
  params: z.object({}),
  item: jobSummarySchema,
});

export const getJobRoute = defineOneRoute("job", {
  path: "/api/projects/:projectId/jobs/:jobId",
  description: "Get a single job",
  params: z.object({ projectId: z.string(), jobId: z.string() }),
  item: jobSchema,
});

/** A job with no project of its own — a placeholder-image pull, a sync preview. */
export const getGlobalJobRoute = defineOneRoute("job", {
  path: "/api/jobs/:jobId",
  description: "Get a single job, whatever project it belongs to",
  params: z.object({ jobId: z.string() }),
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

/**
 * Cancels a job with no project of its own — a sync preview, a placeholder-image pull. The
 * project-scoped route below checks the job belongs to that project, which those can never satisfy,
 * so without this they could be started and never stopped.
 */
export const cancelGlobalJobRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/jobs/:jobId/cancel",
  description: "Cancel a job, whatever project it belongs to",
  params: z.object({ jobId: z.string() }),
  item: jobSchema,
});

export const cancelJobRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/jobs/:jobId/cancel",
  description: "Cancel a running or pending job",
  params: z.object({ projectId: z.string(), jobId: z.string() }),
  item: jobSchema,
});
