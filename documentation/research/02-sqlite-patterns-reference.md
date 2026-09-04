# SQLite Patterns — Reference from reference project

## 1. Libraries Used

| Package | Version | Role |
|---|---|---|
| `better-sqlite3` | ^13.0.3 | Synchronous SQLite driver (native addon) |
| `@types/better-sqlite3` | ^9.6.0 | TypeScript types for the driver |
| `drizzle-orm` | ^0.45.2 | Type-safe ORM / query builder |
| `drizzle-kit` | ^0.31.10 | CLI for generating and managing migrations |

**Why this stack:** `better-sqlite3` is the fastest SQLite binding for Node — synchronous, WAL-capable, no async overhead. Drizzle sits on top as a thin, type-safe query builder that generates SQL at build time rather than runtime reflection. Together they give type safety without the weight of a full ORM like TypeORM or Prisma.

## 2. Database Initialization — `createDatabaseClient()`

Source: `src/api/db/client.ts`

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { DatabaseClient } from "./abstractions/DatabaseClient.js";

export function createDatabaseClient(dbPath: string): DatabaseClient.Interface {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");
    return { db: drizzle(sqlite) };
}
```

Key pragmas:
- **WAL mode** — enables concurrent reads while writing; essential for a server that queries while background jobs insert.
- **busy_timeout = 5000** — waits up to 5 seconds instead of throwing SQLITE_BUSY immediately.
- **foreign_keys = ON** — SQLite disables FK enforcement by default; this turns it on per-connection.

The return type is `{ db: BetterSQLite3Database }`, wrapped behind an abstraction so the DI container can resolve it.

## 3. Schema Definition

Source: `src/api/db/schema.ts`

All tables are defined using Drizzle's `sqliteTable()` declarative API. The schema file is purely declarative — no runtime side effects.

```ts
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    path: text("path").notNull().unique(),
    packageManager: text("package_manager"),
    pmVersion: text("pm_version"),
    addedAt: integer("added_at").notNull(),
    lastScannedAt: integer("last_scanned_at"),
    engineStatus: text("engine_status"),
    rootEnginesNode: text("root_engines_node")
});
```

Patterns used across all tables:
- **Text IDs** — all primary keys are `text("id").primaryKey().notNull()`, generated via `@webiny/stdlib`'s `generateId()`.
- **Timestamps as integers** — `integer("added_at")` stores Unix epoch milliseconds, not ISO strings.
- **Foreign keys** — declared inline via `.references(() => parentTable.id)`, optionally with `{ onDelete: "cascade" }`.
- **Indexes** — defined in the third argument to `sqliteTable()` as a function returning an object of index definitions.
- **JSON in text columns** — complex data (e.g., `logs`, `packages`, `steps`) is stored as serialized JSON in `text` columns.

The reference project has ~25 tables in a single `schema.ts` file.

## 4. Migrations

### Config: `drizzle.config.ts`

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/api/db/schema.ts",
    out: "./src/api/db/migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.DB_PATH ?? "./data/manager.db"
    }
});
```

### Generating migrations

```bash
yarn drizzle-kit generate
```

This diffs the current schema against the last snapshot in `src/api/db/migrations/meta/` and produces a new `.sql` migration file.

### Running migrations at startup

Source: `src/api/db/migrate.ts`

```ts
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export function runMigrations(db: BetterSQLite3Database): void {
    migrate(db, { migrationsFolder: "./src/api/db/migrations" });
}
```

This is called in `server.ts` **before** any service is resolved:

```ts
const databaseClient = createDatabaseClient(DB_PATH);
runMigrations(databaseClient.db);
seedSecurityDefaults(databaseClient.db);
seedAppSettings(databaseClient.db);
```

Migration files are plain SQL (e.g., `0000_graceful_zaran.sql`) with `CREATE TABLE` + `CREATE INDEX` statements separated by `--> statement-breakpoint` markers. The `meta/` subfolder tracks the schema journal for Drizzle Kit's diffing.

### Distribution

The `package.json` `"files"` field includes `"src/api/db/migrations"` so migrations ship with the published package.

## 5. Connection Management

There is no connection pool — `better-sqlite3` is synchronous and single-connection. The database client is created once at server startup and passed into the DI container as a singleton instance:

```ts
// server.ts
const databaseClient = createDatabaseClient(DB_PATH);
const container = createContainer();
ApiFeature.register(container, { databaseClient });
```

Inside the Feature registration:

```ts
// feature.ts
container.registerInstance(DatabaseClient, context.databaseClient);
```

Every use case that needs the database declares `DatabaseClient` as a dependency, and the container injects the same instance.

## 6. DI Abstraction Pattern

The project uses `@webiny/di` for dependency injection. The pattern has three layers:

### 6a. Abstraction definition

Source: `src/api/db/abstractions/DatabaseClient.ts`

```ts
import { createAbstraction } from "#shared/index.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export interface IDatabaseClient {
    readonly db: BetterSQLite3Database;
}

export const DatabaseClient = createAbstraction<IDatabaseClient>("Api/DatabaseClient");

export namespace DatabaseClient {
    export type Interface = IDatabaseClient;
}
```

`createAbstraction` wraps `new Abstraction<T>(name)` from `@webiny/di` — it creates a token the container uses for resolution.

### 6b. Feature registration

The `createFeature()` helper produces a named feature with a `register(container, context)` method:

```ts
export const ApiFeature = createFeature<IApiFeatureContext>({
    name: "Api",
    register(container, context) {
        container.registerInstance(DatabaseClient, context.databaseClient);
        // ... register all other services
    }
});
```

### 6c. Use case consumption

```ts
class ListProjectsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly securityService: SecurityService.Interface
    ) {}

    public async execute(params) {
        const { db } = this.databaseClient;
        // ... use Drizzle query builder directly
    }
}

export const ListProjectsUseCase = Abstraction.createImplementation({
    implementation: ListProjectsUseCaseImpl,
    dependencies: [DatabaseClient, SecurityService]
});
```

The `dependencies` array tells the DI container constructor argument order. No decorators, no reflection — explicit wiring.

## 7. Data Access Patterns

There is **no repository layer on the API side**. Use cases query the database directly using Drizzle's query builder:

```ts
const { db } = this.databaseClient;

// Insert
db.insert(appSettings).values(setting).onConflictDoNothing().run();

// Select with conditions
const rows = db
    .select({ total: count() })
    .from(pmSecuritySettings)
    .where(eq(pmSecuritySettings.packageManager, packageManager))
    .all();

// Complex queries with joins, pagination, ordering
const pagedProjects = await db
    .select()
    .from(projects)
    .where(whereClause)
    .orderBy(...orderClauses)
    .limit(pageSize)
    .offset(offset)
    .all();
```

### UI-side repositories

The UI layer **does** have repository classes, but these are HTTP fetch wrappers, not database accessors:

```
src/ui/features/Projects/ProjectsRepository.ts      — calls /api/projects
src/ui/features/Dashboard/DashboardRepository.ts     — calls /api/dashboard
```

## 8. Seeding

Two seed functions run at startup, after migrations:

- **`seedAppSettings(db)`** — inserts default key/value pairs into `app_settings` using `onConflictDoNothing()` so existing values aren't overwritten.
- **`seedSecurityDefaults(db)`** — conditionally inserts security check definitions for each package manager, checking `count()` first to avoid duplicates.

## 9. Testing

Source: `src/testing/helpers/createTestDb.ts`

```ts
export function createTestDb(): BetterSQLite3Database {
    const dbPath = join(getTestDbDir(), `${randomUUID()}.sqlite`);
    const sqlite = new Database(dbPath);
    sqlite.pragma("foreign_keys = ON");
    const db = drizzle(sqlite);
    runMigrations(db);
    return db;
}

export function createTestDatabaseClient(): DatabaseClient.Interface {
    const db = createTestDb();
    return { db };
}
```

Each test gets a fresh SQLite file in a temp directory, with migrations applied. The temp directory is cleaned up on process exit.

## 10. Summary of Patterns to Adopt

| Concern | Pattern |
|---|---|
| Driver | `better-sqlite3` with WAL mode + busy timeout + FK enforcement |
| Query builder | `drizzle-orm` with `sqliteTable()` declarative schema |
| Migrations | `drizzle-kit generate` → SQL files in `src/api/db/migrations/` |
| Migration runner | `drizzle-orm/better-sqlite3/migrator` called at startup |
| DI integration | `@webiny/di` Abstraction token → `registerInstance()` for the client |
| Data access | Direct Drizzle queries in use cases (no repository layer on API side) |
| IDs | Text UUIDs via `@webiny/stdlib`'s `generateId()` |
| Timestamps | Integer columns storing Unix epoch ms |
| JSON storage | Serialized JSON in `text` columns |
| Testing | Fresh SQLite file per test with migrations applied |
| Seeding | Idempotent seed functions at startup (`onConflictDoNothing`) |
