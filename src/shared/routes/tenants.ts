import { z } from "zod";
import { defineListRoute, defineOneRoute } from "../routing/defineTypedRoutes.js";
import { projectTenantSchema } from "../responses/tenants.js";
import { jobSchema } from "./jobs.js";

export const listProjectTenantsRoute = defineListRoute("tenants", {
  path: "/api/projects/:projectId/environments/:environmentId/tenants",
  description: "List tenants for a project",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: projectTenantSchema,
});

export const syncProjectTenantsRoute = defineOneRoute("job", {
  method: "POST",
  path: "/api/projects/:projectId/environments/:environmentId/tenants/pull",
  description: "Pull tenants from Webiny for a project",
  params: z.object({ projectId: z.string(), environmentId: z.string() }),
  item: jobSchema,
});
