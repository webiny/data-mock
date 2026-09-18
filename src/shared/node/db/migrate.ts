import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

/**
 * Resolved from this file's own location, not from `process.cwd()`.
 *
 * A cwd-relative path means migrations only apply when the process happens to be started from the
 * repository root — and the failure is silent: the database opens, the tables are simply absent,
 * and the first query fails with "no such table" far from the cause.
 */
const MIGRATIONS_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

export function runMigrations(db: BetterSQLite3Database): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
