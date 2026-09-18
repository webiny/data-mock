import { Container } from "@webiny/di";
import { randomBytes } from "node:crypto";
import { PinoLoggerFeature, ProcessEnvFeature } from "@webiny/stdlib/node";
import { createDatabaseClient } from "~/shared/node/db/client.js";
import { runMigrations } from "~/shared/node/db/migrate.js";
import { DatabaseFeature } from "~/shared/node/db/feature.js";
import { EncryptionFeature } from "~/shared/node/encryption/feature.js";
import { GeneratorFeature } from "~/shared/node/generators/feature.js";
import { OperationsFeature } from "~/shared/node/graphql/operations/feature.js";
import { ProjectsFeature } from "~/shared/node/features/projects/feature.js";
import { EnvironmentsFeature } from "~/shared/node/features/environments/feature.js";
import { DeletionFeature } from "~/shared/node/features/deletion/feature.js";
import { ScanRootsFeature } from "~/shared/node/features/scanRoots/feature.js";
import { FileSystemFeature } from "~/shared/node/features/filesystem/feature.js";
import { ChildProcessesFeature } from "~/shared/node/features/childProcesses/feature.js";
import { WebinyCliFeature } from "~/shared/node/features/webinyCli/feature.js";
import { TenantsFeature } from "~/shared/node/features/tenants/feature.js";
import { ModelsFeature } from "~/shared/node/features/models/feature.js";
import { SeedingFeature } from "~/shared/node/features/seeding/feature.js";
import { TemplatesFeature } from "~/shared/node/features/templates/feature.js";
import { FilesFeature } from "~/shared/node/features/files/feature.js";
import { SyncLogsFeature } from "~/shared/node/features/syncLogs/feature.js";
import { WebSocketBroadcaster } from "~/shared/node/websocket/abstractions/WebSocketBroadcaster.js";
import { JobsFeature } from "~/shared/node/jobs/feature.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { EndpointsFeature } from "~/shared/node/graphql/endpoints/feature.js";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";

interface TestContainerOptions {
  httpClient?: HttpClient.Interface;
}

export interface TestContainer {
  container: Container;
  databaseClient: DatabaseClient.Interface;
  cleanup(): void;
}

export function createTestContainer(options: TestContainerOptions = {}): TestContainer {
  const container = new Container();

  PinoLoggerFeature.register(container);
  ProcessEnvFeature.register(container);

  const databaseClient = createDatabaseClient(":memory:");
  runMigrations(databaseClient.db);
  DatabaseFeature.register(container, { databaseClient });

  EncryptionFeature.register(container, { encryptionKey: randomBytes(32).toString("hex") });

  GeneratorFeature.register(container);
  OperationsFeature.register(container);
  TenantsFeature.register(container);
  ModelsFeature.register(container);
  ProjectsFeature.register(container);
  EnvironmentsFeature.register(container);
  DeletionFeature.register(container);
  ScanRootsFeature.register(container);
  FileSystemFeature.register(container);
  ChildProcessesFeature.register(container);
  WebinyCliFeature.register(container);
  SeedingFeature.register(container);
  TemplatesFeature.register(container);
  FilesFeature.register(container);
  SyncLogsFeature.register(container);

  container.registerInstance(WebSocketBroadcaster, createNoOpBroadcaster());
  JobsFeature.register(container);

  if (options.httpClient) {
    container.registerInstance(HttpClient, options.httpClient);
  } else {
    container.registerInstance(HttpClient, createNoOpHttpClient());
  }

  EndpointsFeature.register(container);

  return {
    container,
    databaseClient,
    cleanup() {},
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

function createNoOpBroadcaster(): WebSocketBroadcaster.Interface {
  return {
    broadcast() {},
  };
}
