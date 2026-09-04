import { Result, generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectModels } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { SyncProjectModelsRepository as Abstraction } from "./abstractions/SyncProjectModelsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectModel, ApiCmsModelField } from "~/shared/types.js";
import type { CmsFieldValidation } from "~/shared/node/graphql/operations/base/listContentModels.js";

function sanitizeFieldValidators(fields: ApiCmsModelField[]): ApiCmsModelField[] {
  return fields.map((field) => {
    const sanitized = { ...field };
    if (Array.isArray(sanitized.validation)) {
      sanitized.validation = sanitized.validation.map((v: CmsFieldValidation) => {
        if (v.name === "pattern" && v.settings) {
          if (v.settings.flags === null || v.settings.flags === undefined) {
            return { ...v, settings: { ...v.settings, flags: "" } };
          }
        }
        return v;
      });
    }
    if (field.type === "object" && Array.isArray(field.settings?.fields)) {
      sanitized.settings = {
        ...sanitized.settings,
        fields: sanitizeFieldValidators(field.settings!.fields as ApiCmsModelField[]),
      };
    }
    return sanitized;
  });
}

class SyncProjectModelsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectModel[], Abstraction.Error>> {
    try {
      const { db } = this.databaseClient;
      const now = Date.now();

      db.delete(projectModels).where(eq(projectModels.projectId, input.projectId)).run();

      const rows: ProjectModel[] = input.models.map((m) => ({
        id: generateId(),
        projectId: input.projectId,
        groupSlug: m.groupSlug,
        modelId: m.modelId,
        name: m.name,
        singularApiName: m.singularApiName,
        pluralApiName: m.pluralApiName,
        description: m.description ?? null,
        plugin: m.plugin ?? false,
        fields: sanitizeFieldValidators(m.fields),
        remoteId: m.remoteId ?? null,
        syncedAt: now,
        createdAt: now,
        updatedAt: now,
      }));

      for (const row of rows) {
        db.insert(projectModels)
          .values({
            ...row,
            plugin: row.plugin ? 1 : 0,
            fields: JSON.stringify(row.fields),
          })
          .run();
      }

      return Result.ok(rows);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const SyncProjectModelsRepository = Abstraction.createImplementation({
  implementation: SyncProjectModelsRepositoryImpl,
  dependencies: [DatabaseClient],
});
