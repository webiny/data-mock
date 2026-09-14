import { z } from "zod";

/**
 * The default the operation registry falls back to when no version could be detected — for example
 * a framework workspace root, where `@webiny/cli` resolves to "0.0.0". It must never be null and
 * never "0.0.0": `parseVersion("0.0.0")` yields major 0 and silently selects the lowest registered
 * operation.
 */
export const DEFAULT_OPERATIONS_VERSION = "6.0.0";

export const versionSourceSchema = z.enum([
  "env-var",
  "package-json",
  "node-modules",
  "template-field",
  "workspace-root",
]);

export const syncStatusSchema = z.enum(["success", "partial", "error", "stale-possible"]);

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string().nullable(),
  webinyVersion: z.string().nullable(),
  versionSource: versionSourceSchema.nullable(),
  versionMajor: z.number().nullable(),
  operationsVersion: z.string(),
  pulumiBackend: z.string().nullable(),
  awsProfile: z.string().nullable(),
  awsRegion: z.string().nullable(),
  lastSyncedAt: z.number().nullable(),
  lastSyncStatus: syncStatusSchema.nullable(),
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProjectResponse = z.infer<typeof projectSchema>;

/**
 * A project is created either from a folder on disk (`rootPath`) or as a remote-only connection.
 * A remote-only project supplies the connection fields, which seed its single environment.
 */
export const createProjectBodySchema = z
  .object({
    name: z.string().min(1),
    rootPath: z.string().min(1).optional(),
    operationsVersion: z.string().min(1).optional().default(DEFAULT_OPERATIONS_VERSION),
    awsProfile: z.string().min(1).optional(),
    awsRegion: z.string().min(1).optional(),
    // Remote-only projects: these seed the initial environment.
    env: z.string().min(1).optional().default("dev"),
    apiUrl: z.string().url().optional(),
    apiToken: z.string().min(1).optional(),
    tenant: z.string().optional().default("root"),
  })
  .refine((data) => data.rootPath !== undefined || data.apiUrl !== undefined, {
    message: "Either rootPath or apiUrl must be provided",
  });

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

export const updateProjectBodySchema = z
  .object({
    name: z.string().min(1),
    rootPath: z.string().min(1).nullable(),
    operationsVersion: z.string().min(1),
    awsProfile: z.string().min(1).nullable(),
    awsRegion: z.string().min(1).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
