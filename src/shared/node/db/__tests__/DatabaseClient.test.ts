import { describe, it, expect, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { DatabaseClient } from "../abstractions/DatabaseClient.js";

const containers: Array<{ cleanup(): void }> = [];

function setup() {
  const tc = createTestContainer();
  containers.push(tc);
  return tc;
}

afterEach(() => {
  for (const tc of containers) {
    tc.cleanup();
  }
  containers.length = 0;
});

describe("createDatabaseClient", () => {
  it("should create a database with WAL mode", () => {
    const { databaseClient } = setup();
    const result = databaseClient.db.all<{ journal_mode: string }>(sql`PRAGMA journal_mode`);
    expect(result[0]?.journal_mode).toBe("wal");
  });

  it("should have foreign keys enabled", () => {
    const { databaseClient } = setup();
    const result = databaseClient.db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
    expect(result[0]?.foreign_keys).toBe(1);
  });
});

describe("runMigrations", () => {
  it("should create projects and seed_jobs tables", () => {
    const { databaseClient } = setup();
    const tables = databaseClient.db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '%drizzle%' ORDER BY name`,
    );
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("projects");
    expect(tableNames).toContain("seed_jobs");
  });
});

describe("DatabaseFeature", () => {
  it("should resolve DatabaseClient from container", () => {
    const { container } = setup();
    const resolved = container.resolve(DatabaseClient);
    expect(resolved.db).toBeDefined();
  });

  it("should allow querying through resolved client", () => {
    const { container } = setup();
    const resolved = container.resolve(DatabaseClient);
    const result = resolved.db.all<{ total: number }>(sql`SELECT COUNT(*) as total FROM projects`);
    expect(result[0]?.total).toBe(0);
  });
});
