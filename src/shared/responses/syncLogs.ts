import { z } from "zod";

export const syncLogSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.string(),
  status: z.string(),
  message: z.string(),
  request: z.unknown().nullable(),
  response: z.unknown().nullable(),
  createdAt: z.number(),
});

export type SyncLogResponse = z.infer<typeof syncLogSchema>;
