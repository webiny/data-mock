import { Result, generateId } from "@webiny/stdlib";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { CreateProjectRepository as Abstraction } from "./abstractions/CreateProjectRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { Project } from "~/shared/types.js";

class CreateProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    try {
      const now = Date.now();
      const id = generateId();

      const row = {
        id,
        name: input.name,
        apiUrl: input.apiUrl,
        apiToken: input.apiToken,
        tenant: input.tenant,
        createdAt: now,
        updatedAt: now,
      };

      this.databaseClient.db.insert(projects).values(row).run();

      return Result.ok(row);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const CreateProjectRepository = Abstraction.createImplementation({
  implementation: CreateProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
