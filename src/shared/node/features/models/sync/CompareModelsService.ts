import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { ListProjectModelsRepository } from "~/shared/node/features/models/list/abstractions/ListProjectModelsRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { CompareModelsService as Abstraction } from "./abstractions/CompareModelsService.js";
import { GraphQLRequestError } from "~/shared/errors.js";
import type { ProjectModel, ApiCmsModelField } from "~/shared/types.js";

interface RemoteModel {
  modelId: string;
  name: string;
  fields: ApiCmsModelField[];
}

class CompareModelsServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly listProjectModelsRepository: ListProjectModelsRepository.Interface,
    private readonly httpClient: HttpClient.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const projectResult = await this.getProjectRepository.execute({ id: input.projectId });
    if (projectResult.isFail()) {
      return Result.fail(projectResult.error);
    }

    const project = projectResult.value;

    const localResult = await this.listProjectModelsRepository.execute({
      projectId: input.projectId,
    });
    if (localResult.isFail()) {
      return Result.fail(localResult.error);
    }

    const remoteResult = await this.fetchRemoteModels(
      project.apiUrl.replace(/\/cms\/manage$/, ""),
      project.apiToken,
      project.tenant,
    );
    if (remoteResult.isFail()) {
      return Result.fail(remoteResult.error);
    }

    const localModels = localResult.value;
    const remoteModels = remoteResult.value;

    const localMap = new Map(localModels.map((m) => [m.modelId, m]));
    const remoteMap = new Map(remoteModels.map((m) => [m.modelId, m]));

    const items: Abstraction.DiffItem[] = [];

    for (const [modelId, remote] of remoteMap) {
      const local = localMap.get(modelId);
      if (!local) {
        items.push({ modelId, name: remote.name, status: "added" });
      } else {
        const changes = this.diffFields(local, remote);
        if (changes.length > 0) {
          items.push({ modelId, name: remote.name, status: "changed", changes });
        } else {
          items.push({ modelId, name: remote.name, status: "unchanged" });
        }
      }
    }

    for (const [modelId, local] of localMap) {
      if (!remoteMap.has(modelId)) {
        items.push({ modelId, name: local.name, status: "removed" });
      }
    }

    this.logger.info(
      `Compared ${localModels.length} local vs ${remoteModels.length} remote models for project "${project.name}".`,
    );

    return Result.ok({ items });
  }

  private diffFields(local: ProjectModel, remote: RemoteModel): string[] {
    const changes: string[] = [];

    const localFields = new Map(local.fields.map((f) => [f.fieldId, f]));
    const remoteFields = new Map(remote.fields.map((f) => [f.fieldId, f]));

    for (const [fieldId, remoteField] of remoteFields) {
      const localField = localFields.get(fieldId);
      if (!localField) {
        changes.push(`Field "${fieldId}" added (${remoteField.type})`);
      } else if (localField.type !== remoteField.type) {
        changes.push(`Field "${fieldId}" type changed: ${localField.type} → ${remoteField.type}`);
      } else if (localField.list !== remoteField.list) {
        changes.push(`Field "${fieldId}" list changed: ${localField.list} → ${remoteField.list}`);
      }
    }

    for (const [fieldId] of localFields) {
      if (!remoteFields.has(fieldId)) {
        changes.push(`Field "${fieldId}" removed`);
      }
    }

    return changes;
  }

  private async fetchRemoteModels(
    baseUrl: string,
    token: string,
    tenant: string,
  ): Promise<Result<RemoteModel[], GraphQLRequestError>> {
    const query = `{
      listContentModels {
        data {
          modelId name
          fields {
            id fieldId storageId type list
            settings
            predefinedValues { enabled values { label value selected } }
            validation { name message settings }
            listValidation { name message settings }
          }
        }
        error { message code }
      }
    }`;

    try {
      const response = await this.httpClient.post(
        `${baseUrl}/cms/manage`,
        JSON.stringify({ query }),
        {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
          "x-tenant": tenant,
        },
      );

      if (response.status !== 200) {
        const text = await response.text().catch(() => "");
        return Result.fail(
          new GraphQLRequestError(
            `Model fetch failed with status ${response.status}`,
            response.status,
            text,
          ),
        );
      }

      const json = (await response.json()) as {
        data?: { listContentModels?: { data?: RemoteModel[]; error?: { message: string } } };
      };

      const gqlData = json.data?.listContentModels;
      if (gqlData?.error) {
        return Result.fail(new GraphQLRequestError(gqlData.error.message, 200));
      }

      return Result.ok(gqlData?.data ?? []);
    } catch (error) {
      return Result.fail(
        new GraphQLRequestError(
          error instanceof Error ? error.message : "Failed to fetch models",
          0,
        ),
      );
    }
  }
}

export const CompareModelsService = Abstraction.createImplementation({
  implementation: CompareModelsServiceImpl,
  dependencies: [GetProjectRepository, ListProjectModelsRepository, HttpClient, Logger],
});
