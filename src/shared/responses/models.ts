import { z } from "zod";

export const projectGroupSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  remoteId: z.string().nullable(),
  syncedAt: z.number().nullable(),
  createdAt: z.number(),
});

export type ProjectGroupResponse = z.infer<typeof projectGroupSchema>;

export const projectModelSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  groupSlug: z.string(),
  modelId: z.string(),
  name: z.string(),
  singularApiName: z.string(),
  pluralApiName: z.string(),
  description: z.string().nullable(),
  fields: z.array(z.unknown()),
  remoteId: z.string().nullable(),
  syncedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProjectModelResponse = z.infer<typeof projectModelSchema>;

export const modelSyncResultSchema = z.object({
  groups: z.number(),
  models: z.number(),
});

export type ModelSyncResult = z.infer<typeof modelSyncResultSchema>;
