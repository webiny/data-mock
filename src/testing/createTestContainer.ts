import { Container } from "@webiny/di";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PinoLoggerFeature, ProcessEnvFeature } from "@webiny/stdlib/node";
import { createDatabaseClient } from "~/db/client.js";
import { runMigrations } from "~/db/migrate.js";
import { DatabaseFeature } from "~/db/feature.js";
import { CacheFeature } from "~/cache/feature.js";
import { GeneratorFeature } from "~/generators/feature.js";
import { ProjectRepositoryFeature } from "~/shared/features/ProjectRepositoryFeature.js";
import { GraphQLClient } from "~/graphql/abstractions/GraphQLClient.js";
import { GraphQLClientImpl } from "~/graphql/GraphQLClient.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import type { DatabaseClient } from "~/db/abstractions/DatabaseClient.js";

const TEST_DIR = join(process.cwd(), ".webiny", "test");

interface TestContainerOptions {
  httpClient?: HttpClient.Interface;
}

interface TestContainer {
  container: Container;
  databaseClient: DatabaseClient.Interface;
  dbPath: string;
  cleanup(): void;
}

export function createTestContainer(options: TestContainerOptions = {}): TestContainer {
  const testId = randomUUID();
  const testDir = join(TEST_DIR, testId);
  mkdirSync(testDir, { recursive: true });

  const dbPath = join(testDir, "test.sqlite");
  const cacheDir = join(testDir, "cache");

  const container = new Container();

  PinoLoggerFeature.register(container);
  ProcessEnvFeature.register(container);

  const databaseClient = createDatabaseClient(dbPath);
  runMigrations(databaseClient.db);
  DatabaseFeature.register(container, { databaseClient });

  CacheFeature.register(container, { cacheDir });

  GeneratorFeature.register(container);
  ProjectRepositoryFeature.register(container);

  const httpClient = options.httpClient ?? createNoOpHttpClient();
  const graphqlClient = new GraphQLClientImpl(httpClient, {
    url: "http://localhost:0",
    token: "test-token",
    tenant: "root",
    retries: 0,
    retryMinTimeout: 0,
  });
  container.registerInstance(GraphQLClient, graphqlClient);

  return {
    container,
    databaseClient,
    dbPath,
    cleanup() {
      rmSync(testDir, { recursive: true, force: true });
    },
  };
}

function createNoOpHttpClient(): HttpClient.Interface {
  return {
    async post() {
      throw new Error(
        "HttpClient not mocked. Pass a mock httpClient to createTestContainer() or register one on the container.",
      );
    },
  };
}
