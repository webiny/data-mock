import { Result } from "@webiny/stdlib";
import { and, asc, eq, isNull } from "drizzle-orm";
import { projectEnvironments } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { ListEnvironmentsRepository as Abstraction } from "./abstractions/ListEnvironmentsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { toEnvironment, toEnvironmentError } from "../toEnvironment.js";
import type { ProjectEnvironment } from "~/shared/types.js";

class ListEnvironmentsRepositoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly encryptionService: EncryptionService.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectEnvironment[], Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(projectEnvironments)
        .where(
          input.includeArchived === true
            ? eq(projectEnvironments.projectId, input.projectId)
            : and(
                eq(projectEnvironments.projectId, input.projectId),
                isNull(projectEnvironments.archivedAt),
              ),
        )
        .orderBy(asc(projectEnvironments.env), asc(projectEnvironments.variant))
        .all();

      const environments = rows.map((row) =>
        toEnvironment(
          row,
          row.apiToken === null ? null : this.encryptionService.decrypt(row.apiToken),
        ),
      );

      return Result.ok(environments);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toEnvironmentError(error)));
    }
  }
}

export const ListEnvironmentsRepository = Abstraction.createImplementation({
  implementation: ListEnvironmentsRepositoryImpl,
  dependencies: [DatabaseClient, EncryptionService],
});
