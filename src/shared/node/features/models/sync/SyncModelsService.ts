import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { CmsManageEndpointClient } from "~/shared/node/graphql/endpoints/abstractions/CmsManageEndpointClient.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { SyncProjectGroupsRepository } from "./abstractions/SyncProjectGroupsRepository.js";
import { SyncProjectModelsRepository } from "./abstractions/SyncProjectModelsRepository.js";
import { SyncModelsService as Abstraction } from "./abstractions/SyncModelsService.js";
import { GraphQLRequestError } from "~/shared/errors.js";
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
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly cmsManageClient: CmsManageEndpointClient.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
    private readonly syncProjectGroupsRepository: SyncProjectGroupsRepository.Interface,
    private readonly syncProjectModelsRepository: SyncProjectModelsRepository.Interface,
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${project.apiToken}`,
      "x-tenant": project.tenant,
    };

    const operations: OperationLog[] = [];

    const groupsResult = await this.fetchWithOperation<RemoteGroup[]>(
      "listContentModelGroups",
      project.webinyVersion,
      project.apiUrl,
      headers,
      operations,
    );
    if (groupsResult.isFail()) {
      return Result.fail(groupsResult.error);
    }

    const modelsResult = await this.fetchWithOperation<RemoteModel[]>(
      "listContentModels",
      project.webinyVersion,
      project.apiUrl,
      headers,
      operations,
    );
    if (modelsResult.isFail()) {
      return Result.fail(modelsResult.error);
    }

    const groups = groupsResult.value;
    const models = modelsResult.value;

    const syncGroupsResult = await this.syncProjectGroupsRepository.execute({
      projectId: project.id,
      groups: groups.map((g) => ({
        slug: g.slug,
        name: g.name,
        description: g.description,
        icon: g.icon ? JSON.stringify(g.icon) : null,
        remoteId: g.id,
      })),
    });

    if (syncGroupsResult.isFail()) {
      return Result.fail(syncGroupsResult.error);
    }

    const syncModelsResult = await this.syncProjectModelsRepository.execute({
      projectId: project.id,
      models: models.map((m) => ({
        groupSlug: m.group,
        modelId: m.modelId,
        name: m.name,
        singularApiName: m.singularApiName,
        pluralApiName: m.pluralApiName,
        description: m.description ?? null,
        plugin: m.plugin,
        fields: m.fields,
        remoteId: m.modelId,
      })),
    });

    if (syncModelsResult.isFail()) {
      return Result.fail(syncModelsResult.error);
    }

    this.logger.info(
      `Synced ${groups.length} group(s) and ${models.length} model(s) for project "${project.name}".`,
    );

    return Result.ok({ groups: groups.length, models: models.length, operations });
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
    GetProjectRepository,
    CmsManageEndpointClient,
    OperationRegistry,
    SyncProjectGroupsRepository,
    SyncProjectModelsRepository,
    Logger,
  ],
});
