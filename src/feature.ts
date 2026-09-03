import { createFeature } from "@webiny/stdlib";
import { createDatabaseClient } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { DatabaseFeature } from "./db/feature.js";

const DEFAULT_DB_PATH = "./.webiny/data-mock.db";

export const AppFeature = createFeature({
  name: "AppFeature",
  register(container) {
    const dbPath = process.env.DB_PATH ?? DEFAULT_DB_PATH;
    const databaseClient = createDatabaseClient(dbPath);
    runMigrations(databaseClient.db);

    DatabaseFeature.register(container, { databaseClient });
  },
});
