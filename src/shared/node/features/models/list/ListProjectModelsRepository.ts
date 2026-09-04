import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectModels } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListProjectModelsRepository as Abstraction } from "./abstractions/ListProjectModelsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectModel, ApiCmsModelField } from "~/shared/types.js";

class ListProjectModelsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectModel[], Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(projectModels)
        .where(eq(projectModels.projectId, input.projectId))
        .all();

      const models: ProjectModel[] = rows.map((row) => ({
        ...row,
        plugin: row.plugin === 1,
        fields: JSON.parse(row.fields) as ApiCmsModelField[],
      }));

      return Result.ok(models);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListProjectModelsRepository = Abstraction.createImplementation({
  implementation: ListProjectModelsRepositoryImpl,
  dependencies: [DatabaseClient],
});
