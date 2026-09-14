import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import {
  projectSchema,
  createProjectBodySchema,
  updateProjectBodySchema,
} from "../responses/projects.js";
import { deletionImpactSchema } from "../responses/deletion.js";

/** Archived projects are omitted unless `?includeArchived=true`. */
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

/**
 * DELETE archives. Every child table cascades from `projects`, so a real delete would destroy the
 * project's seed entries, sync logs, job history, models, tenants and files — that is
 * `purgeProjectRoute`, which is a separate, explicit request.
 */
export const archiveProjectRoute = defineOneRoute("project", {
  method: "DELETE",
  path: "/api/projects/:id",
  description: "Archive a Webiny project connection, keeping all of its data",
  params: z.object({ id: z.string() }),
  item: projectSchema,
});

export const restoreProjectRoute = defineOneRoute("project", {
  method: "POST",
  path: "/api/projects/:id/restore",
  description: "Restore an archived Webiny project connection",
  params: z.object({ id: z.string() }),
  item: projectSchema,
});

/** Irreversible: deletes the project row and everything that cascades from it. */
export const purgeProjectRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/projects/:id/purge",
  description: "Permanently delete a project and every row that cascades from it",
  params: z.object({ id: z.string() }),
});

export const projectDeletionImpactRoute = defineOneRoute("impact", {
  path: "/api/projects/:id/deletion-impact",
  description: "Count the rows a purge of this project would destroy",
  params: z.object({ id: z.string() }),
  item: deletionImpactSchema,
});
