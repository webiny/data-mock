import { z } from "zod";

export const projectTenantSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  tenantId: z.string(),
  name: z.string(),
  discoveredAt: z.number(),
});

export type ProjectTenantResponse = z.infer<typeof projectTenantSchema>;
