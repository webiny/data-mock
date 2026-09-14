import { Result, generateId } from "@webiny/stdlib";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { CreateProjectRepository as Abstraction } from "./abstractions/CreateProjectRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { DEFAULT_OPERATIONS_VERSION } from "~/shared/responses/projects.js";
import { toProject, toProjectError } from "../toProject.js";
import type { Project } from "~/shared/types.js";

class CreateProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    try {
      const now = Date.now();

      const row = {
        id: generateId(),
        name: input.name,
        rootPath: input.rootPath ?? null,
        webinyVersion: input.webinyVersion ?? null,
        versionSource: input.versionSource ?? null,
        versionMajor: input.versionMajor ?? null,
        operationsVersion: input.operationsVersion ?? DEFAULT_OPERATIONS_VERSION,
        pulumiBackend: input.pulumiBackend ?? null,
        awsProfile: input.awsProfile ?? null,
        awsRegion: input.awsRegion ?? null,
        lastSyncedAt: null,
        lastSyncStatus: null,
        createdAt: now,
        updatedAt: now,
      };

      this.databaseClient.db.insert(projects).values(row).run();

      return Result.ok(toProject(row));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toProjectError(error)));
    }
  }
}

export const CreateProjectRepository = Abstraction.createImplementation({
  implementation: CreateProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
