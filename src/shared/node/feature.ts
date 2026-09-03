import { createFeature } from "@webiny/stdlib";
import { PinoLoggerFeature, ProcessEnvFeature } from "@webiny/stdlib/node";
import { createDatabaseClient } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { DatabaseFeature } from "./db/feature.js";
import { CacheFeature } from "./cache/feature.js";
import { EncryptionFeature } from "./encryption/feature.js";
import { FetchHttpClient } from "./FetchHttpClient.js";
import { GeneratorFeature } from "./generators/feature.js";
import { OperationsFeature } from "./graphql/operations/feature.js";
import { ProjectsFeature } from "./features/projects/feature.js";
import { TenantsFeature } from "./features/tenants/feature.js";
import { ModelsFeature } from "./features/models/feature.js";
import { SeedingFeature } from "./features/seeding/feature.js";
import { TemplatesFeature } from "./features/templates/feature.js";

const DEFAULT_DB_PATH = "./.webiny/data-mock.db";

export const AppFeature = createFeature({
  name: "AppFeature",
  register(container) {
    PinoLoggerFeature.register(container);
    ProcessEnvFeature.register(container);

    const encryptionKey = process.env.ENCRYPTION_KEY;
    EncryptionFeature.register(container, { encryptionKey: encryptionKey ?? "" });

    const dbPath = process.env.DB_PATH ?? DEFAULT_DB_PATH;
    const databaseClient = createDatabaseClient(dbPath);
    runMigrations(databaseClient.db);

    DatabaseFeature.register(container, { databaseClient });
    CacheFeature.register(container, {});
    container.register(FetchHttpClient).inSingletonScope();
    GeneratorFeature.register(container);
    OperationsFeature.register(container);
    ProjectsFeature.register(container);
    TenantsFeature.register(container);
    ModelsFeature.register(container);
    SeedingFeature.register(container);
    TemplatesFeature.register(container);
  },
});
