import { Result, generateId } from "@webiny/stdlib";
import { projectEnvironments } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { CreateEnvironmentRepository as Abstraction } from "./abstractions/CreateEnvironmentRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { toEnvironment, toEnvironmentError } from "../toEnvironment.js";
import type { ProjectEnvironment } from "~/shared/types.js";

class CreateEnvironmentRepositoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly encryptionService: EncryptionService.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectEnvironment, Abstraction.Error>> {
    try {
      const now = Date.now();
      const apiToken = input.apiToken ?? null;

      const row = {
        id: generateId(),
        projectId: input.projectId,
        env: input.env,
        variant: input.variant ?? "",
        region: input.region ?? null,
        deployed: input.deployed === true ? 1 : 0,
        apiUrl: input.apiUrl ?? null,
        adminUrl: input.adminUrl ?? null,
        apiToken: apiToken === null ? null : this.encryptionService.encrypt(apiToken),
        tenant: input.tenant ?? "root",
        lastSyncedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      this.databaseClient.db.insert(projectEnvironments).values(row).run();

      return Result.ok(toEnvironment(row, apiToken));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toEnvironmentError(error)));
    }
  }
}

export const CreateEnvironmentRepository = Abstraction.createImplementation({
  implementation: CreateEnvironmentRepositoryImpl,
  dependencies: [DatabaseClient, EncryptionService],
});
