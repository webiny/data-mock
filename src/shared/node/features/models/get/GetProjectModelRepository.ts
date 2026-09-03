import { Result } from "@webiny/stdlib";
import { and, eq } from "drizzle-orm";
import { projectModels } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { GetProjectModelRepository as Abstraction } from "./abstractions/GetProjectModelRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectModel, ApiCmsModelField } from "~/shared/types.js";

class GetProjectModelRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<ProjectModel, Abstraction.Error>> {
    try {
      const row = this.databaseClient.db
        .select()
        .from(projectModels)
        .where(
          and(
            eq(projectModels.projectId, input.projectId),
            eq(projectModels.modelId, input.modelId),
          ),
        )
        .get();

      if (!row) {
        return Result.fail(new ProjectNotFoundError(`${input.projectId}/${input.modelId}`));
      }

      const model: ProjectModel = {
        ...row,
        fields: JSON.parse(row.fields) as ApiCmsModelField[],
      };

      return Result.ok(model);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const GetProjectModelRepository = Abstraction.createImplementation({
  implementation: GetProjectModelRepositoryImpl,
  dependencies: [DatabaseClient],
});
