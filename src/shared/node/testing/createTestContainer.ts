import { Container } from "@webiny/di";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PinoLoggerFeature, ProcessEnvFeature } from "@webiny/stdlib/node";
import { createDatabaseClient } from "~/shared/node/db/client.js";
import { runMigrations } from "~/shared/node/db/migrate.js";
import { DatabaseFeature } from "~/shared/node/db/feature.js";
import { CacheFeature } from "~/shared/node/cache/feature.js";
import { GeneratorFeature } from "~/shared/node/generators/feature.js";
import { ProjectsFeature } from "~/shared/node/features/projects/feature.js";
import { GraphQLConfig } from "~/shared/node/graphql/abstractions/GraphQLConfig.js";
import { GraphQLClient as GraphQLClientImpl } from "~/shared/node/graphql/GraphQLClient.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";

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
  ProjectsFeature.register(container);

  if (options.httpClient) {
    container.registerInstance(HttpClient, options.httpClient);
  } else {
    container.registerInstance(HttpClient, createNoOpHttpClient());
  }

  container.registerInstance(GraphQLConfig, {
    url: "http://localhost:0",
    token: "test-token",
    tenant: "root",
    retries: 0,
    retryMinTimeout: 0,
  });

  container.register(GraphQLClientImpl).inSingletonScope();

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
