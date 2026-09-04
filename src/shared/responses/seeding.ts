import { z } from "zod";

export const revisionsSchema = z.union([
  z.number().int().min(1),
  z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
]);

export const publishStrategySchema = z.enum(["none", "all", "random", "first", "last"]);

export const seedJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "dry-run"]),
  config: z.object({
    models: z.array(
      z.object({
        modelId: z.string(),
        amount: z.number(),
        revisions: revisionsSchema.optional(),
      }),
    ),
    publishStrategy: publishStrategySchema.optional(),
    publishPercent: z.number().optional(),
    includeUnpublish: z.boolean().optional(),
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
      revisions: revisionsSchema.optional().default(1),
    }),
  ),
  publishStrategy: publishStrategySchema.optional().default("none"),
  publishPercent: z.number().int().min(0).max(100).optional(),
  includeUnpublish: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
  batchSize: z.number().int().min(1).max(50).optional().default(1),
});

export type TriggerSeedBody = z.infer<typeof triggerSeedBodySchema>;
