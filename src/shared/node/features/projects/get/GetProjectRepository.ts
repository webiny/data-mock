import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { GetProjectRepository as Abstraction } from "./abstractions/GetProjectRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { toProject, toProjectError } from "../toProject.js";
import type { Project } from "~/shared/types.js";

class GetProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    try {
      const row = this.databaseClient.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get();

      if (!row) {
        return Result.fail(new ProjectNotFoundError(input.id));
      }

      return Result.ok(toProject(row));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toProjectError(error)));
    }
  }
}

export const GetProjectRepository = Abstraction.createImplementation({
  implementation: GetProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
