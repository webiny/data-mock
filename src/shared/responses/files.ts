import { z } from "zod";

export const projectFileSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  tenant: z.string(),
  fileKey: z.string(),
  fileUrl: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().nullable(),
  uploadedAt: z.number(),
});

export type ProjectFileResponse = z.infer<typeof projectFileSchema>;

export const uploadFileBodySchema = z.object({
  tenant: z.string().min(1),
  fileName: z.string().min(1),
  fileContent: z.string().min(1),
  fileType: z.string().optional(),
});

export type UploadFileBody = z.infer<typeof uploadFileBodySchema>;

export const syncFilesBodySchema = z.object({
  tenant: z.string().min(1),
});

export type SyncFilesBody = z.infer<typeof syncFilesBodySchema>;

export const syncFilesResponseSchema = z.object({
  synced: z.number(),
});

export type SyncFilesResponse = z.infer<typeof syncFilesResponseSchema>;

export const pullPicsumBodySchema = z.object({
  count: z.number().int().min(1).max(100),
  width: z.number().int().min(100).max(4000).optional().default(800),
  height: z.number().int().min(100).max(4000).optional().default(600),
});

export type PullPicsumBody = z.infer<typeof pullPicsumBodySchema>;

export const pullPicsumResponseSchema = z.object({
  downloaded: z.number(),
  directory: z.string(),
  files: z.array(z.string()),
});

export type PullPicsumResponse = z.infer<typeof pullPicsumResponseSchema>;

export const localFileProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
});

export type LocalFileProjectResponse = z.infer<typeof localFileProjectSchema>;

export const localFileSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  uploadedToProjects: z.array(localFileProjectSchema),
});

export type LocalFileResponse = z.infer<typeof localFileSchema>;

export const uploadLocalFileBodySchema = z.object({
  fileName: z.string().min(1),
  fileContent: z.string().min(1),
});

export type UploadLocalFileBody = z.infer<typeof uploadLocalFileBodySchema>;

export const localFileUploadResultSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
});

export type LocalFileUploadResult = z.infer<typeof localFileUploadResultSchema>;

export const uploadGlobalBodySchema = z.object({
  tenant: z.string().min(1),
  fileNames: z.array(z.string()).optional(),
});

export type UploadGlobalBody = z.infer<typeof uploadGlobalBodySchema>;

export const uploadGlobalResultSchema = z.object({
  uploaded: z.number(),
  files: z.array(projectFileSchema),
});

export type UploadGlobalResult = z.infer<typeof uploadGlobalResultSchema>;
