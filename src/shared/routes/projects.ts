import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import {
  projectSchema,
  createProjectBodySchema,
  updateProjectBodySchema,
} from "../responses/projects.js";

export const listProjectsRoute = defineListRoute("projects", {
  path: "/api/projects",
  description: "List all configured Webiny projects",
  params: z.object({}),
  item: projectSchema,
});

export const getProjectRoute = defineOneRoute("project", {
  path: "/api/projects/:id",
  description: "Get a single Webiny project by ID",
  params: z.object({ id: z.string() }),
  item: projectSchema,
});

export const createProjectRoute = defineOneRoute("project", {
  method: "POST",
  path: "/api/projects",
  description: "Add a new Webiny project connection",
  params: z.object({}),
  body: createProjectBodySchema,
  item: projectSchema,
});

export const updateProjectRoute = defineOneRoute("project", {
  method: "PUT",
  path: "/api/projects/:id",
  description: "Update a Webiny project connection",
  params: z.object({ id: z.string() }),
  body: updateProjectBodySchema,
  item: projectSchema,
});

export const healthCheckProjectRoute = defineOneRoute("health", {
  method: "POST",
  path: "/api/projects/:id/health",
  description: "Check if a project's Webiny API is reachable",
  params: z.object({ id: z.string() }),
  item: z.object({ reachable: z.boolean(), error: z.string().nullable() }),
});

export const removeProjectRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/projects/:id",
  description: "Remove a Webiny project connection",
  params: z.object({ id: z.string() }),
});
