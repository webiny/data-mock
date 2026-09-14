import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import {
  projectEnvironmentSchema,
  projectStackSchema,
  createEnvironmentBodySchema,
  updateEnvironmentBodySchema,
} from "../responses/environments.js";
import { deletionImpactSchema } from "../responses/deletion.js";
import { jobSchema } from "./jobs.js";

/** Archived environments are omitted unless `?includeArchived=true`. */
export const listProjectEnvironmentsRoute = defineListRoute("environments", {
  path: "/api/projects/:projectId/environments",
  description: "List environments discovered for a project",
  params: z.object({ projectId: z.string() }),
  item: projectEnvironmentSchema,
});

export const getProjectEnvironmentRoute = defineOneRoute("environment", {
  path: "/api/projects/:projectId/environments/:environmentId",
  description: "Get a single environment",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: projectEnvironmentSchema,
});

/**
 * Manual creation covers remote Pulumi backends, where stack state lives in a bucket and the local
 * glob finds nothing.
 */
export const createProjectEnvironmentRoute = defineOneRoute("environment", {
  method: "POST",
  path: "/api/projects/:projectId/environments",
  description: "Add an environment to a project manually",
  params: z.object({ projectId: z.string() }),
  body: createEnvironmentBodySchema,
  item: projectEnvironmentSchema,
});

export const updateProjectEnvironmentRoute = defineOneRoute("environment", {
  method: "PUT",
  path: "/api/projects/:projectId/environments/:environmentId",
  description: "Update an environment's connection details",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  body: updateEnvironmentBodySchema,
  item: projectEnvironmentSchema,
});

/**
 * DELETE archives. An archived environment keeps its slot in the (project, env, variant) unique
 * index, so sync will not insert a duplicate beside it, and it keeps the seed entries, models,
 * tenants, files and job history that belong to it. `purgeProjectEnvironmentRoute` destroys those.
 */
export const archiveProjectEnvironmentRoute = defineOneRoute("environment", {
  method: "DELETE",
  path: "/api/projects/:projectId/environments/:environmentId",
  description: "Archive an environment, keeping all of its data",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: projectEnvironmentSchema,
});

export const restoreProjectEnvironmentRoute = defineOneRoute("environment", {
  method: "POST",
  path: "/api/projects/:projectId/environments/:environmentId/restore",
  description: "Restore an archived environment",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: projectEnvironmentSchema,
});

/** Irreversible: deletes the environment row and everything that cascades from it. */
export const purgeProjectEnvironmentRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/projects/:projectId/environments/:environmentId/purge",
  description: "Permanently delete an environment and every row that cascades from it",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
});

export const environmentDeletionImpactRoute = defineOneRoute("impact", {
  path: "/api/projects/:projectId/environments/:environmentId/deletion-impact",
  description: "Count the rows a purge of this environment would destroy",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: deletionImpactSchema,
});

export const listEnvironmentStacksRoute = defineListRoute("stacks", {
  path: "/api/projects/:projectId/environments/:environmentId/stacks",
  description: "List per-app Pulumi stack state for an environment",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: projectStackSchema,
});

export const syncProjectRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/sync",
  description: "Sync a project's version, environments and stack output from disk",
  params: z.object({ projectId: z.string() }),
  item: jobSchema,
});

export const healthCheckEnvironmentRoute = defineOneRoute("health", {
  method: "POST",
  path: "/api/projects/:projectId/environments/:environmentId/health",
  description: "Check whether an environment's Webiny API is reachable",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: z.object({ reachable: z.boolean(), error: z.string().nullable() }),
});
