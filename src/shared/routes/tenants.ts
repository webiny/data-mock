import { z } from "zod";
import { defineListRoute, defineOneRoute } from "../routing/defineTypedRoutes.js";
import { projectTenantSchema } from "../responses/tenants.js";

export const listProjectTenantsRoute = defineListRoute("tenants", {
  path: "/api/projects/:projectId/tenants",
  description: "List tenants for a project",
  params: z.object({ projectId: z.string() }),
  item: projectTenantSchema,
});

export const syncProjectTenantsRoute = defineOneRoute("sync", {
  method: "POST",
  path: "/api/projects/:projectId/tenants/sync",
  description: "Sync tenants from Webiny for a project",
  params: z.object({ projectId: z.string() }),
  item: z.object({
    synced: z.number(),
    tenants: z.array(
      z.object({
        tenantId: z.string(),
        name: z.string(),
      }),
    ),
  }),
});
