import { z } from "zod";

export const seedTemplateConfigSchema = z.object({
  tenant: z.string(),
  models: z.array(
    z.object({
      modelId: z.string(),
      amount: z.number().int().positive(),
    }),
  ),
});

export const seedTemplateSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  config: seedTemplateConfigSchema,
  createdAt: z.number(),
});

export const createSeedTemplateBodySchema = z.object({
  name: z.string().min(1),
  config: seedTemplateConfigSchema,
});

export type SeedTemplateResponse = z.infer<typeof seedTemplateSchema>;
export type CreateSeedTemplateBody = z.infer<typeof createSeedTemplateBodySchema>;
