import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import {
  projectEnvironmentSchema,
  projectStackSchema,
  createEnvironmentBodySchema,
  updateEnvironmentBodySchema,
} from "../responses/environments.js";
import { jobSchema } from "./jobs.js";

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

export const removeProjectEnvironmentRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/projects/:projectId/environments/:environmentId",
  description: "Remove an environment",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
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
