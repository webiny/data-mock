import { z } from "zod";

export const projectTenantSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  environmentId: z.string(),
  tenantId: z.string(),
  name: z.string(),
  apiToken: z.string().nullable(),
  discoveredAt: z.number(),
});

export const updateTenantBodySchema = z.object({
  /** Null removes the tenant's own token. */
  apiToken: z.string().min(1).nullable(),
});

export type UpdateTenantBody = z.infer<typeof updateTenantBodySchema>;

export type ProjectTenantResponse = z.infer<typeof projectTenantSchema>;
