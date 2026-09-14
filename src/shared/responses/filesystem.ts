import { z } from "zod";

export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isWebinyProject: z.boolean(),
  readable: z.boolean(),
});

export const browseResultSchema = z.object({
  path: z.string(),
  parentPath: z.string().nullable(),
  isWebinyProject: z.boolean(),
  entries: z.array(directoryEntrySchema),
});

export type BrowseResultResponse = z.infer<typeof browseResultSchema>;

export const projectCandidateSchema = z.object({
  rootPath: z.string(),
  name: z.string(),
  versionMajor: z.number().nullable(),
  webinyVersion: z.string().nullable(),
  registered: z.boolean(),
});

export const scanResultSchema = z.object({
  candidates: z.array(projectCandidateSchema),
  errors: z.array(z.object({ path: z.string(), message: z.string() })),
});

export type ScanResultResponse = z.infer<typeof scanResultSchema>;

/**
 * `paths` scans directories that are not saved roots — the "scan this folder" flow. Omit it to
 * scan every stored scan root.
 */
export const scanBodySchema = z.object({
  paths: z.array(z.string().min(1)).optional(),
  maxDepth: z.number().int().min(0).max(8).optional(),
});

export type ScanBody = z.infer<typeof scanBodySchema>;

export const scanRootSchema = z.object({
  id: z.string(),
  path: z.string(),
  createdAt: z.number(),
});

export type ScanRootResponse = z.infer<typeof scanRootSchema>;

export const createScanRootBodySchema = z.object({
  path: z.string().min(1),
});

export type CreateScanRootBody = z.infer<typeof createScanRootBodySchema>;
