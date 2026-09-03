import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { SyncProjectGroupsRepository } from "./abstractions/SyncProjectGroupsRepository.js";
import { SyncProjectModelsRepository } from "./abstractions/SyncProjectModelsRepository.js";
import { SyncModelsService as Abstraction } from "./abstractions/SyncModelsService.js";
import { GraphQLRequestError } from "~/shared/errors.js";
import type { ApiCmsModelField } from "~/shared/types.js";

interface WebinyGroup {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface WebinyModel {
  modelId: string;
  name: string;
  description: string;
  group: { slug: string };
  fields: ApiCmsModelField[];
}

class SyncModelsServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly httpClient: HttpClient.Interface,
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
    const baseUrl = project.apiUrl.replace(/\/cms\/manage$/, "");

    const groupsResult = await this.fetchGroups(baseUrl, project.apiToken, project.tenant);
    if (groupsResult.isFail()) {
      return Result.fail(groupsResult.error);
    }

    const modelsResult = await this.fetchModels(baseUrl, project.apiToken, project.tenant);
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
        icon: g.icon,
        remoteId: g.id,
      })),
    });

    if (syncGroupsResult.isFail()) {
      return Result.fail(syncGroupsResult.error);
    }

    const syncModelsResult = await this.syncProjectModelsRepository.execute({
      projectId: project.id,
      models: models.map((m) => ({
        groupSlug: m.group.slug,
        modelId: m.modelId,
        name: m.name,
        description: m.description,
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

    return Result.ok({ groups: groups.length, models: models.length });
  }

  private async fetchGroups(
    baseUrl: string,
    token: string,
    tenant: string,
  ): Promise<Result<WebinyGroup[], GraphQLRequestError>> {
    const query = `{
      listContentModelGroups {
        data {
          id slug name description icon
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
            `Group fetch failed with status ${response.status}`,
            response.status,
            text,
          ),
        );
      }

      const json = (await response.json()) as {
        data?: { listContentModelGroups?: { data?: WebinyGroup[]; error?: { message: string } } };
      };

      const gqlData = json.data?.listContentModelGroups;
      if (gqlData?.error) {
        return Result.fail(new GraphQLRequestError(gqlData.error.message, 200));
      }

      return Result.ok(gqlData?.data ?? []);
    } catch (error) {
      return Result.fail(
        new GraphQLRequestError(
          error instanceof Error ? error.message : "Failed to fetch groups",
          0,
        ),
      );
    }
  }

  private async fetchModels(
    baseUrl: string,
    token: string,
    tenant: string,
  ): Promise<Result<WebinyModel[], GraphQLRequestError>> {
    const query = `{
      listContentModels {
        data {
          modelId name description
          group { slug }
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
        data?: { listContentModels?: { data?: WebinyModel[]; error?: { message: string } } };
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

export const SyncModelsService = Abstraction.createImplementation({
  implementation: SyncModelsServiceImpl,
  dependencies: [
    GetProjectRepository,
    HttpClient,
    SyncProjectGroupsRepository,
    SyncProjectModelsRepository,
    Logger,
  ],
});
