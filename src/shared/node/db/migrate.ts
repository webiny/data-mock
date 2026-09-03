import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export function runMigrations(db: BetterSQLite3Database): void {
  migrate(db, { migrationsFolder: "./src/shared/node/db/migrations" });
}
