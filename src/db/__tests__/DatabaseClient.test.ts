import { describe, it, expect, afterEach } from "vitest";
import { Container } from "@webiny/di";
import { sql } from "drizzle-orm";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../client.js";
import { runMigrations } from "../migrate.js";
import { DatabaseFeature } from "../feature.js";
import { DatabaseClient } from "../abstractions/DatabaseClient.js";

const TEST_DB_DIR = join(process.cwd(), ".webiny", "test");

function createTestDb() {
  mkdirSync(TEST_DB_DIR, { recursive: true });
  const dbPath = join(TEST_DB_DIR, `${randomUUID()}.sqlite`);
  const client = createDatabaseClient(dbPath);
  runMigrations(client.db);
  return { client, dbPath };
}

afterEach(() => {
  rmSync(TEST_DB_DIR, { recursive: true, force: true });
});

describe("createDatabaseClient", () => {
  it("should create a database with WAL mode", () => {
    const { client } = createTestDb();
    const result = client.db.all<{ journal_mode: string }>(sql`PRAGMA journal_mode`);
    expect(result[0]?.journal_mode).toBe("wal");
  });

  it("should have foreign keys enabled", () => {
    const { client } = createTestDb();
    const result = client.db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
    expect(result[0]?.foreign_keys).toBe(1);
  });
});

describe("runMigrations", () => {
  it("should create projects and seed_jobs tables", () => {
    const { client } = createTestDb();
    const tables = client.db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '%drizzle%' ORDER BY name`,
    );
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("projects");
    expect(tableNames).toContain("seed_jobs");
  });
});

describe("DatabaseFeature", () => {
  it("should register and resolve DatabaseClient from container", () => {
    const { client } = createTestDb();
    const container = new Container();
    DatabaseFeature.register(container, { databaseClient: client });

    const resolved = container.resolve(DatabaseClient);
    expect(resolved.db).toBeDefined();
  });

  it("should allow querying through resolved client", () => {
    const { client } = createTestDb();
    const container = new Container();
    DatabaseFeature.register(container, { databaseClient: client });

    const resolved = container.resolve(DatabaseClient);
    const result = resolved.db.all<{ total: number }>(sql`SELECT COUNT(*) as total FROM projects`);
    expect(result[0]?.total).toBe(0);
  });
});
