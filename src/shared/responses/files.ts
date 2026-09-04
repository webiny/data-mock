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
