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
  description: z.string().nullable(),
  fields: z.array(z.unknown()),
  remoteId: z.string().nullable(),
  syncedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProjectModelResponse = z.infer<typeof projectModelSchema>;

export const modelDiffItemSchema = z.object({
  modelId: z.string(),
  name: z.string(),
  status: z.enum(["added", "removed", "changed", "unchanged"]),
  changes: z.array(z.string()).optional(),
});

export type ModelDiffItem = z.infer<typeof modelDiffItemSchema>;

export const modelSyncResultSchema = z.object({
  groups: z.number(),
  models: z.number(),
});

export type ModelSyncResult = z.infer<typeof modelSyncResultSchema>;

export const modelPushResultSchema = z.object({
  pushed: z.object({ groups: z.number(), models: z.number() }),
  skipped: z.object({ groups: z.number(), models: z.number() }),
});

export type ModelPushResult = z.infer<typeof modelPushResultSchema>;
