import { z } from "zod";

export const seedEntrySchema = z.object({
  id: z.string(),
  jobId: z.string(),
  projectId: z.string(),
  tenant: z.string(),
  modelId: z.string(),
  entryId: z.string(),
  entryData: z.record(z.string(), z.unknown()),
  responseData: z.record(z.string(), z.unknown()).nullable(),
  httpStatus: z.number().nullable(),
  status: z.enum(["created", "failed", "dry-run"]),
  error: z.string().nullable(),
  createdAt: z.number(),
});

export type SeedEntryResponse = z.infer<typeof seedEntrySchema>;
