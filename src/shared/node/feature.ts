import { createFeature } from "@webiny/stdlib";
import { PinoLoggerFeature, ProcessEnvFeature } from "@webiny/stdlib/node";
import { createDatabaseClient } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { DatabaseFeature } from "./db/feature.js";
import { CacheFeature } from "./cache/feature.js";
import { ProjectsFeature } from "./features/projects/feature.js";

const DEFAULT_DB_PATH = "./.webiny/data-mock.db";

export const AppFeature = createFeature({
  name: "AppFeature",
  register(container) {
    PinoLoggerFeature.register(container);
    ProcessEnvFeature.register(container);

    const dbPath = process.env.DB_PATH ?? DEFAULT_DB_PATH;
    const databaseClient = createDatabaseClient(dbPath);
    runMigrations(databaseClient.db);

    DatabaseFeature.register(container, { databaseClient });
    CacheFeature.register(container, {});
    ProjectsFeature.register(container);
  },
});
