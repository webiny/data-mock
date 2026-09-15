import { z } from "zod";

/**
 * One field a sync would rewrite. Values are already rendered as text: the panel only has to show
 * them, and a number, a URL, a boolean and a key count all read the same way there.
 */
export const syncFieldChangeSchema = z.object({
  field: z.string(),
  label: z.string(),
  current: z.string().nullable(),
  incoming: z.string().nullable(),
});

export const syncStackChangeSchema = z.object({
  app: z.string(),
  change: z.enum(["added", "updated", "unchanged", "unreadable"]),
  fields: z.array(syncFieldChangeSchema),
});

export const syncEnvironmentChangeSchema = z.object({
  stackName: z.string(),
  env: z.string(),
  variant: z.string(),
  change: z.enum(["added", "updated", "unchanged", "skipped"]),
  /** Why an environment was skipped, or what is notable about it. Null when there is nothing. */
  note: z.string().nullable(),
  fields: z.array(syncFieldChangeSchema),
  stacks: z.array(syncStackChangeSchema),
});

/**
 * What a sync would write, read the same way the sync itself reads it but stored nowhere.
 *
 * Nothing here is a promise: applying re-reads the state rather than replaying this preview, so a
 * checkout that changes in between produces a different result. It is a preview of an intent, not
 * a transaction.
 */
export const syncPreviewSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  /** A remote backend has no checkpoints on disk, so it discovers no environments. */
  backend: z.enum(["local", "remote"]),
  hasChanges: z.boolean(),
  project: z.array(syncFieldChangeSchema),
  environments: z.array(syncEnvironmentChangeSchema),
  messages: z.array(z.string()),
});

export type SyncFieldChangeResponse = z.infer<typeof syncFieldChangeSchema>;
export type SyncStackChangeResponse = z.infer<typeof syncStackChangeSchema>;
export type SyncEnvironmentChangeResponse = z.infer<typeof syncEnvironmentChangeSchema>;
export type SyncPreviewResponse = z.infer<typeof syncPreviewSchema>;

/**
 * What a `sync-preview` job leaves on its row: one preview per project it could read, and a reason
 * for each it could not.
 */
export const syncPreviewJobResultSchema = z.object({
  previews: z.array(syncPreviewSchema),
  failures: z.array(z.object({ projectId: z.string(), error: z.string() })),
});

export type SyncPreviewJobResult = z.infer<typeof syncPreviewJobResultSchema>;
