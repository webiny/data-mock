import { Result } from "@webiny/stdlib";
import { isNull } from "drizzle-orm";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListProjectsRepository as Abstraction } from "./abstractions/ListProjectsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { toProject, toProjectError } from "../toProject.js";
import type { Project } from "~/shared/types.js";

class ListProjectsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input?: Abstraction.Input): Promise<Result<Project[], Abstraction.Error>> {
    try {
      const query = this.databaseClient.db.select().from(projects);

      const rows =
        input?.includeArchived === true
          ? query.all()
          : query.where(isNull(projects.archivedAt)).all();

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
