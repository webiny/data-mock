import { z } from "zod";
import { defineListRoute, defineOneRoute, defineVoidRoute } from "../routing/defineTypedRoutes.js";
import { seedTemplateSchema, createSeedTemplateBodySchema } from "../responses/templates.js";

export const listSeedTemplatesRoute = defineListRoute("templates", {
  method: "GET",
  path: "/api/projects/:projectId/templates",
  description: "List seed templates for a project",
  params: z.object({ projectId: z.string() }),
  item: seedTemplateSchema,
});

export const createSeedTemplateRoute = defineOneRoute("template", {
  method: "POST",
  path: "/api/projects/:projectId/templates",
  description: "Create a seed template",
  params: z.object({ projectId: z.string() }),
  body: createSeedTemplateBodySchema,
  item: seedTemplateSchema,
});

export const deleteSeedTemplateRoute = defineVoidRoute({
  method: "DELETE",
  path: "/api/projects/:projectId/templates/:templateId",
  description: "Delete a seed template",
  params: z.object({ projectId: z.string(), templateId: z.string() }),
});
