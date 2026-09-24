import { z } from "zod";

export const stackReadStateSchema = z.enum(["deployed", "not-deployed", "unknown"]);

export const projectStackSchema = z.object({
  id: z.string(),
  environmentId: z.string(),
  app: z.string(),
  deployed: z.boolean(),
  resourceCount: z.number().nullable(),
  stackOutput: z.record(z.string(), z.unknown()).nullable(),
  readState: stackReadStateSchema,
  syncedAt: z.number().nullable(),
});

export type ProjectStackResponse = z.infer<typeof projectStackSchema>;

export const projectEnvironmentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  env: z.string(),
  variant: z.string(),
  region: z.string().nullable(),
  deployed: z.boolean(),
  apiUrl: z.string().nullable(),
  adminUrl: z.string().nullable(),
  apiToken: z.string().nullable(),
  tenant: z.string(),
  lastSyncedAt: z.number().nullable(),
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProjectEnvironmentResponse = z.infer<typeof projectEnvironmentSchema>;

/**
 * `variant` defaults to "" rather than null — SQLite treats NULLs as distinct in unique indexes, so
 * a nullable variant would let duplicate (project, env) rows through. Webiny rejects these three
 * variant names outright (`isValidVariantName`).
 */
const variantSchema = z
  .string()
  .optional()
  .default("")
  .refine((value) => !["none", "empty", "blank"].includes(value.toLowerCase()), {
    message: 'Variant cannot be named "none", "empty" or "blank"',
  });

export const createEnvironmentBodySchema = z.object({
  env: z.string().min(1),
  variant: variantSchema,
  region: z.string().min(1).optional(),
  apiUrl: z.string().url().optional(),
  apiToken: z.string().min(1).optional(),
  tenant: z.string().optional().default("root"),
});

export type CreateEnvironmentBody = z.infer<typeof createEnvironmentBodySchema>;

export const updateEnvironmentBodySchema = z
  .object({
    region: z.string().min(1).nullable(),
    apiUrl: z.string().url().nullable(),
    apiToken: z.string().min(1).nullable(),
    tenant: z.string().min(1),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateEnvironmentBody = z.infer<typeof updateEnvironmentBodySchema>;

/**
 * Deploy and destroy bodies. `apps` is optional; empty means every deployable app for the
 * project's version, expanded server-side.
 */
export const deployEnvironmentBodySchema = z.object({
  apps: z.array(z.string().min(1)).optional(),
  region: z.string().min(1).optional(),
  /** Plan the change and create nothing. Deploy only — destroy has no preview. */
  preview: z.boolean().optional(),
});

export type DeployEnvironmentBody = z.infer<typeof deployEnvironmentBodySchema>;

/**
 * Destroy additionally requires the project's name typed back. The UI asks for it, but the check
 * lives here too: a confirmation that only exists in the browser is not a confirmation.
 */
export const destroyEnvironmentBodySchema = deployEnvironmentBodySchema
  .omit({ preview: true })
  .extend({
    confirmProjectName: z.string().min(1),
  });

export type DestroyEnvironmentBody = z.infer<typeof destroyEnvironmentBodySchema>;

export const deployableAppsSchema = z.object({
  apps: z.array(z.string()),
  versionMajor: z.number().nullable(),
});

export type DeployableAppsResponse = z.infer<typeof deployableAppsSchema>;
