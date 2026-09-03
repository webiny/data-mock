import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { ListProjectGroupsRepository } from "~/shared/node/features/models/list/abstractions/ListProjectGroupsRepository.js";
import { ListProjectModelsRepository } from "~/shared/node/features/models/list/abstractions/ListProjectModelsRepository.js";
import { GraphQLRequestError } from "~/shared/errors.js";
import { PushModelsService as Abstraction } from "./abstractions/PushModelsService.js";
import type { ProjectGroup, ProjectModel } from "~/shared/types.js";
import { eq, and } from "drizzle-orm";
import { projectGroups, projectModels } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";

class PushModelsServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly httpClient: HttpClient.Interface,
    private readonly listProjectGroupsRepository: ListProjectGroupsRepository.Interface,
    private readonly listProjectModelsRepository: ListProjectModelsRepository.Interface,
    private readonly databaseClient: DatabaseClient.Interface,
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${project.apiToken}`,
      "x-tenant": project.tenant,
    };

    const groupsResult = await this.listProjectGroupsRepository.execute({
      projectId: project.id,
    });
    if (groupsResult.isFail()) {
      return Result.fail(groupsResult.error);
    }

    const modelsResult = await this.listProjectModelsRepository.execute({
      projectId: project.id,
    });
    if (modelsResult.isFail()) {
      return Result.fail(modelsResult.error);
    }

    let pushedGroups = 0;
    let skippedGroups = 0;

    for (const group of groupsResult.value) {
      if (group.remoteId) {
        skippedGroups++;
        continue;
      }

      const pushResult = await this.pushGroup(group, baseUrl, headers);
      if (pushResult.isFail()) {
        this.logger.warn(`Failed to push group "${group.name}": ${pushResult.error.message}`);
        continue;
      }

      this.databaseClient.db
        .update(projectGroups)
        .set({ remoteId: pushResult.value })
        .where(and(eq(projectGroups.projectId, project.id), eq(projectGroups.slug, group.slug)))
        .run();

      pushedGroups++;
    }

    let pushedModels = 0;
    let skippedModels = 0;

    for (const model of modelsResult.value) {
      if (model.remoteId) {
        skippedModels++;
        continue;
      }

      const pushResult = await this.pushModel(model, baseUrl, headers);
      if (pushResult.isFail()) {
        this.logger.warn(`Failed to push model "${model.name}": ${pushResult.error.message}`);
        continue;
      }

      this.databaseClient.db
        .update(projectModels)
        .set({ remoteId: pushResult.value })
        .where(
          and(eq(projectModels.projectId, project.id), eq(projectModels.modelId, model.modelId)),
        )
        .run();

      pushedModels++;
    }

    this.logger.info(
      `Pushed ${pushedGroups} group(s), ${pushedModels} model(s). Skipped ${skippedGroups} group(s), ${skippedModels} model(s).`,
    );

    return Result.ok({
      pushed: { groups: pushedGroups, models: pushedModels },
      skipped: { groups: skippedGroups, models: skippedModels },
    });
  }

  private async pushGroup(
    group: ProjectGroup,
    baseUrl: string,
    headers: Record<string, string>,
  ): Promise<Result<string, GraphQLRequestError>> {
    const mutation = `
      mutation CreateContentModelGroup($data: CmsContentModelGroupInput!) {
        cms { createContentModelGroup(data: $data) { data { id slug name } error { message code } } }
      }
    `;

    try {
      const response = await this.httpClient.post(
        `${baseUrl}/cms/manage`,
        JSON.stringify({
          query: mutation,
          variables: {
            data: {
              slug: group.slug,
              name: group.name,
              description: group.description ?? "",
              icon: group.icon ?? "fas/folder",
            },
          },
        }),
        headers,
      );

      if (response.status !== 200) {
        return Result.fail(new GraphQLRequestError(`HTTP ${response.status}`, response.status));
      }

      const json = (await response.json()) as Record<string, unknown>;
      const data = json["data"] as Record<string, unknown> | undefined;
      const cms = data?.["cms"] as Record<string, unknown> | undefined;
      const result = cms?.["createContentModelGroup"] as Record<string, unknown> | undefined;
      const error = result?.["error"] as { message: string; code: string } | null | undefined;

      if (error) {
        return Result.fail(new GraphQLRequestError(error.message, 200));
      }

      const created = result?.["data"] as { id: string } | undefined;
      return Result.ok(created?.id ?? group.slug);
    } catch (err) {
      return Result.fail(
        new GraphQLRequestError(err instanceof Error ? err.message : "Push group failed", 0),
      );
    }
  }

  private async pushModel(
    model: ProjectModel,
    baseUrl: string,
    headers: Record<string, string>,
  ): Promise<Result<string, GraphQLRequestError>> {
    const mutation = `
      mutation CreateContentModel($data: CmsContentModelCreateInput!) {
        cms { createContentModel(data: $data) { data { modelId name } error { message code } } }
      }
    `;

    try {
      const response = await this.httpClient.post(
        `${baseUrl}/cms/manage`,
        JSON.stringify({
          query: mutation,
          variables: {
            data: {
              modelId: model.modelId,
              name: model.name,
              description: model.description ?? "",
              group: model.groupSlug,
              fields: model.fields,
            },
          },
        }),
        headers,
      );

      if (response.status !== 200) {
        return Result.fail(new GraphQLRequestError(`HTTP ${response.status}`, response.status));
      }

      const json = (await response.json()) as Record<string, unknown>;
      const data = json["data"] as Record<string, unknown> | undefined;
      const cms = data?.["cms"] as Record<string, unknown> | undefined;
      const result = cms?.["createContentModel"] as Record<string, unknown> | undefined;
      const error = result?.["error"] as { message: string; code: string } | null | undefined;

      if (error) {
        return Result.fail(new GraphQLRequestError(error.message, 200));
      }

      const created = result?.["data"] as { modelId: string } | undefined;
      return Result.ok(created?.modelId ?? model.modelId);
    } catch (err) {
      return Result.fail(
        new GraphQLRequestError(err instanceof Error ? err.message : "Push model failed", 0),
      );
    }
  }
}

export const PushModelsService = Abstraction.createImplementation({
  implementation: PushModelsServiceImpl,
  dependencies: [
    GetProjectRepository,
    HttpClient,
    ListProjectGroupsRepository,
    ListProjectModelsRepository,
    DatabaseClient,
    Logger,
  ],
});
