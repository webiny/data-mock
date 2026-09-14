import { Result } from "@webiny/stdlib";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListProjectsRepository as Abstraction } from "./abstractions/ListProjectsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { toProject, toProjectError } from "../toProject.js";
import type { Project } from "~/shared/types.js";

class ListProjectsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(): Promise<Result<Project[], Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db.select().from(projects).all();
      return Result.ok(rows.map(toProject));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toProjectError(error)));
    }
  }
}

export const ListProjectsRepository = Abstraction.createImplementation({
  implementation: ListProjectsRepositoryImpl,
  dependencies: [DatabaseClient],
});
