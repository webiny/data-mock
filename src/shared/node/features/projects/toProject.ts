import { projects } from "~/shared/node/db/schema.js";
import { versionSourceSchema, syncStatusSchema } from "~/shared/responses/projects.js";
import { readSeededProjectNames } from "~/shared/node/seedProjects.js";
import type { Project } from "~/shared/types.js";

type ProjectRow = typeof projects.$inferSelect;

/**
 * Maps a `projects` row onto the domain type.
 *
 * SQLite stores `version_source` and `last_sync_status` as free text, so both are validated here
 * rather than asserted — an unrecognised value degrades to null instead of lying about its type.
 *
 * `seeded` is read from `.projects.json` rather than stored, so removing an entry from that file
 * takes effect on the next read instead of the next boot. `seededNames` is passed in when a caller
 * maps many rows, so the file is read once per query rather than once per project.
 */
export function toProject(row: ProjectRow, seededNames?: Set<string>): Project {
  const seeded = (seededNames ?? readSeededProjectNames()).has(row.name);
  const versionSource = versionSourceSchema.safeParse(row.versionSource);
  const lastSyncStatus = syncStatusSchema.safeParse(row.lastSyncStatus);

  return {
    id: row.id,
    name: row.name,
    rootPath: row.rootPath,
    webinyVersion: row.webinyVersion,
    versionSource: versionSource.success ? versionSource.data : null,
    versionMajor: row.versionMajor,
    operationsVersion: row.operationsVersion,
    pulumiBackend: row.pulumiBackend,
    awsProfile: row.awsProfile,
    awsRegion: row.awsRegion,
    lastSyncedAt: row.lastSyncedAt,
    lastSyncStatus: lastSyncStatus.success ? lastSyncStatus.data : null,
    archivedAt: row.archivedAt,
    seeded,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toProjectError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
