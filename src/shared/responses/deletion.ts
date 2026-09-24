import { z } from "zod";

/**
 * The rows a hard delete would destroy. Returned before a purge so the confirmation can state the
 * loss in numbers instead of "this cannot be undone".
 */
export const deletionImpactSchema = z.object({
  environments: z.number(),
  stacks: z.number(),
  tenants: z.number(),
  groups: z.number(),
  models: z.number(),
  files: z.number(),
  seedJobs: z.number(),
  seedEntries: z.number(),
  syncLogs: z.number(),
  jobs: z.number(),
  seedTemplates: z.number(),
});

export type DeletionImpactResponse = z.infer<typeof deletionImpactSchema>;
