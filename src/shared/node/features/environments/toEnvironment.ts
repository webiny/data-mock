import { projectEnvironments, projectStacks } from "~/shared/node/db/schema.js";
import { stackReadStateSchema } from "~/shared/responses/environments.js";
import type { GenericRecord, ProjectEnvironment, ProjectStack } from "~/shared/types.js";

type EnvironmentRow = typeof projectEnvironments.$inferSelect;
type StackRow = typeof projectStacks.$inferSelect;

/**
 * Maps a `project_environments` row onto the domain type.
 *
 * `apiToken` is passed in already decrypted rather than decrypted here, so this stays a pure
 * function and the encryption dependency stays in the repositories.
 */
export function toEnvironment(row: EnvironmentRow, apiToken: string | null): ProjectEnvironment {
  return {
    id: row.id,
    projectId: row.projectId,
    env: row.env,
    variant: row.variant,
    region: row.region,
    deployed: row.deployed === 1,
    apiUrl: row.apiUrl,
    adminUrl: row.adminUrl,
    apiToken,
    tenant: row.tenant,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toStack(row: StackRow): ProjectStack {
  const readState = stackReadStateSchema.safeParse(row.readState);

  return {
    id: row.id,
    environmentId: row.environmentId,
    app: row.app,
    deployed: row.deployed === 1,
    resourceCount: row.resourceCount,
    stackOutput: parseStackOutput(row.stackOutput),
    // An unrecognised value means the row was written by something we do not understand; treat it
    // as unreadable rather than claiming a deployment state.
    readState: readState.success ? readState.data : "unknown",
    syncedAt: row.syncedAt,
  };
}

function parseStackOutput(value: string | null): GenericRecord<string, unknown> | null {
  if (value === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as GenericRecord<string, unknown>;
  } catch {
    return null;
  }
}

export function toEnvironmentError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
