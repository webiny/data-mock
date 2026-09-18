import { Result, Logger } from "@webiny/stdlib";
import { EnvironmentContextService } from "~/shared/node/features/environments/context/abstractions/EnvironmentContextService.js";
import { CmsManageEndpointClient } from "~/shared/node/graphql/endpoints/abstractions/CmsManageEndpointClient.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { SyncProjectGroupsRepository } from "./abstractions/SyncProjectGroupsRepository.js";
import { SyncProjectModelsRepository } from "./abstractions/SyncProjectModelsRepository.js";
import { SyncModelsService as Abstraction } from "./abstractions/SyncModelsService.js";
import { GraphQLRequestError } from "~/shared/errors.js";
import { isExcludedModel } from "~/shared/node/models/excludedModels.js";
import type { ApiCmsModelField, OperationLog } from "~/shared/types.js";

interface RemoteIcon {
  type: string;
  name: string;
  value?: string;
}

interface RemoteGroup {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: RemoteIcon | null;
}

interface RemoteModel {
  modelId: string;
  name: string;
  singularApiName: string;
  pluralApiName: string;
  description?: string | null;
  group: string;
  plugin: boolean;
  fields: ApiCmsModelField[];
}

class SyncModelsServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly environmentContextService: EnvironmentContextService.Interface,
    private readonly cmsManageClient: CmsManageEndpointClient.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
    private readonly syncProjectGroupsRepository: SyncProjectGroupsRepository.Interface,
    private readonly syncProjectModelsRepository: SyncProjectModelsRepository.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const contextResult = await this.environmentContextService.execute({
      environmentId: input.environmentId,
    });

    if (contextResult.isFail()) {
      return Result.fail(contextResult.error);
    }

    const { project, environment, apiUrl, apiToken, tenant, operationsVersion } =
      contextResult.value;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${apiToken}`,
      "x-tenant": tenant,
    };

    const operations: OperationLog[] = [];
    const onProgress = input.onProgress;

    onProgress?.(10, "Fetching content model groups...");

    const groupsResult = await this.fetchWithOperation<RemoteGroup[]>(
      "listContentModelGroups",
      operationsVersion,
      apiUrl,
      headers,
      operations,
    );
    if (groupsResult.isFail()) {
      return Result.fail(groupsResult.error);
    }

    onProgress?.(35, "Fetching content models...");

    const modelsResult = await this.fetchWithOperation<RemoteModel[]>(
      "listContentModels",
      operationsVersion,
      apiUrl,
      headers,
      operations,
    );
    if (modelsResult.isFail()) {
      return Result.fail(modelsResult.error);
    }

    const groups = groupsResult.value;
    const models = modelsResult.value;

    onProgress?.(60, "Syncing groups...");

    const syncGroupsResult = await this.syncProjectGroupsRepository.execute({
      projectId: project.id,
      environmentId: environment.id,
      groups: groups.map((group) => ({
        slug: group.slug,
        name: group.name,
        description: group.description,
        icon: group.icon ? JSON.stringify(group.icon) : null,
        remoteId: group.id,
      })),
    });

    if (syncGroupsResult.isFail()) {
      return Result.fail(syncGroupsResult.error);
    }

    const userModels = models.filter((model) => !isExcludedModel(model.modelId));

    onProgress?.(85, "Syncing models...");

    const syncModelsResult = await this.syncProjectModelsRepository.execute({
      projectId: project.id,
      environmentId: environment.id,
      models: userModels.map((model) => ({
        groupSlug: model.group,
        modelId: model.modelId,
        name: model.name,
        singularApiName: model.singularApiName,
        pluralApiName: model.pluralApiName,
        description: model.description ?? null,
        plugin: model.plugin,
        fields: model.fields,
        remoteId: model.modelId,
      })),
    });

    if (syncModelsResult.isFail()) {
      return Result.fail(syncModelsResult.error);
    }

    const skipped = models.length - userModels.length;
    if (skipped > 0) {
      this.logger.info(`Excluded ${skipped} system/plugin model(s) from sync.`);
    }
    this.logger.info(
      `Synced ${groups.length} group(s) and ${userModels.length} model(s) for project "${project.name}".`,
    );

    return Result.ok({ groups: groups.length, models: userModels.length, operations });
  }

  private async fetchWithOperation<T>(
    operationName: string,
    version: string,
    apiUrl: string,
    headers: Record<string, string>,
    logs: OperationLog[],
  ): Promise<Result<T, GraphQLRequestError>> {
    const operation = this.operationRegistry.resolve<void, T>(operationName, version);

    try {
      const response = await this.cmsManageClient.post(
        apiUrl,
        JSON.stringify({ query: operation.query }),
        headers,
      );

      if (response.status !== 200) {
        const text = await response.text().catch(() => "");
        logs.push({
          name: operationName,
          url: apiUrl,
          query: operation.query.trim(),
          httpStatus: response.status,
          response: text,
        });
        return Result.fail(
          new GraphQLRequestError(
            `${operationName} failed with status ${response.status}`,
            response.status,
            text,
          ),
        );
      }

      const json = (await response.json()) as Record<string, unknown>;
      logs.push({
        name: operationName,
        url: apiUrl,
        query: operation.query.trim(),
        httpStatus: response.status,
        response: json,
      });

      const gqlResult = operation.getResult({
        data: (json["data"] ?? {}) as Record<string, unknown>,
      });

      if (gqlResult.error) {
        return Result.fail(new GraphQLRequestError(gqlResult.error.message, 200));
      }

      return Result.ok(gqlResult.data as T);
    } catch (error) {
      logs.push({
        name: operationName,
        url: apiUrl,
        query: operation.query.trim(),
        httpStatus: 0,
        response: error instanceof Error ? error.message : String(error),
      });
      return Result.fail(
        new GraphQLRequestError(
          error instanceof Error ? error.message : `Failed to execute ${operationName}`,
          0,
        ),
      );
    }
  }
}

export const SyncModelsService = Abstraction.createImplementation({
  implementation: SyncModelsServiceImpl,
  dependencies: [
    EnvironmentContextService,
    CmsManageEndpointClient,
    OperationRegistry,
    SyncProjectGroupsRepository,
    SyncProjectModelsRepository,
    Logger,
  ],
});
