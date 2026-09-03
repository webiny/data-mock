import { z } from "zod";

export const seedJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "dry-run"]),
  config: z.object({
    models: z.array(z.object({ modelId: z.string(), amount: z.number() })),
  }),
  result: z
    .object({
      created: z.number(),
      errors: z.array(z.object({ message: z.string(), code: z.string() })),
    })
    .nullable(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  createdAt: z.number(),
});

export type SeedJobResponse = z.infer<typeof seedJobSchema>;

export const triggerSeedBodySchema = z.object({
  tenant: z.string().min(1),
  models: z.array(
    z.object({
      modelId: z.string().min(1),
      amount: z.number().int().min(1),
    }),
  ),
  dryRun: z.boolean().optional().default(false),
});

export type TriggerSeedBody = z.infer<typeof triggerSeedBodySchema>;
