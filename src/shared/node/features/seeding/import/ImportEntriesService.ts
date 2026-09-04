import { Result, Logger } from "@webiny/stdlib";
import { ImportEntriesService as Abstraction } from "./abstractions/ImportEntriesService.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { GetProjectModelRepository } from "~/shared/node/features/models/get/abstractions/GetProjectModelRepository.js";
import { CmsManageEndpointClient } from "~/shared/node/graphql/endpoints/abstractions/CmsManageEndpointClient.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { CreateSeedEntryRepository } from "~/shared/node/features/seeding/entries/abstractions/CreateSeedEntryRepository.js";
import { createModelFields } from "~/shared/node/fields/createModelFields.js";
import { buildListEntriesQuery } from "~/shared/node/graphql/operations/base/listContentEntries.js";
import { GraphQLRequestError, SeedingError } from "~/shared/errors.js";
import type {
  ApiGraphQLResultJson,
  GenericRecord,
} from "~/shared/node/graphql/abstractions/GraphQLClient.js";
import type { Project, ProjectModel } from "~/shared/types.js";

const PAGE_SIZE = 100;

interface ListEntriesData {
  data: GenericRecord[];
  meta: { totalCount: number; hasMoreItems: boolean; cursor: string | null };
}

interface GqlOp {
  getResult(json: ApiGraphQLResultJson): { data?: unknown; error?: { message: string } };
  getVariables?(input: unknown): GenericRecord;
}

class ImportEntriesServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly getProjectModelRepository: GetProjectModelRepository.Interface,
    private readonly cmsManageClient: CmsManageEndpointClient.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
    private readonly createSeedEntryRepository: CreateSeedEntryRepository.Interface,
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

    const models: Array<{ modelId: string; count: number }> = [];
    let imported = 0;

    try {
      for (const modelId of input.models) {
        const modelResult = await this.getProjectModelRepository.execute({
          projectId: project.id,
          modelId,
        });
        if (modelResult.isFail()) {
          return Result.fail(modelResult.error);
        }

        const count = await this.importModel(project, modelResult.value, input.tenant);
        models.push({ modelId, count });
        imported += count;
      }
    } catch (err) {
      if (err instanceof GraphQLRequestError) {
        return Result.fail(err);
      }
      return Result.fail(new SeedingError(err instanceof Error ? err : new Error(String(err))));
    }

    return Result.ok({ imported, models });
  }

  private async importModel(
    project: Project,
    model: ProjectModel,
    tenant: string,
  ): Promise<number> {
    const fieldSelection = createModelFields(model.fields);
    const { pluralApiName } = model;
    const query = buildListEntriesQuery({ pluralApiName, fieldSelection }).query;
    const listOp = this.operationRegistry.resolve("listContentEntries", project.webinyVersion);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${project.apiToken}`,
      "x-tenant": tenant,
    };

    let cursor: string | null = null;
    let count = 0;
    let hasMore = true;

    this.logger.info(`Importing entries for model "${model.name}"...`);

    while (hasMore) {
      const page = await this.fetchPage(project.apiUrl, query, headers, listOp, cursor);

      for (const entry of page.data) {
        const entryId = typeof entry["id"] === "string" ? entry["id"] : "";
        await this.createSeedEntryRepository.execute({
          jobId: null,
          projectId: project.id,
          tenant,
          modelId: model.modelId,
          entryId,
          entryData: entry,
          requestData: null,
          responseData: null,
          httpStatus: null,
          status: "imported",
          error: null,
        });
        count++;
      }

      hasMore = page.meta.hasMoreItems && Boolean(page.meta.cursor);
      cursor = page.meta.cursor;
    }

    this.logger.info(`Imported ${count} entries for model "${model.name}".`);

    return count;
  }

  private async fetchPage(
    apiUrl: string,
    query: string,
    headers: Record<string, string>,
    op: GqlOp,
    after: string | null,
  ): Promise<ListEntriesData> {
    const variables = op.getVariables ? op.getVariables({ limit: PAGE_SIZE, after }) : {};
    const body = JSON.stringify({ query, variables });
    const response = await this.cmsManageClient.post(apiUrl, body, headers);

    if (response.status !== 200) {
      const text = await response.text().catch(() => "");
      throw new GraphQLRequestError(`HTTP ${response.status}: ${text}`, response.status);
    }

    const json = (await response.json()) as ApiGraphQLResultJson;
    const result = op.getResult(json);

    if (result.error) {
      throw new GraphQLRequestError(result.error.message, 200);
    }

    const data = result.data as ListEntriesData | undefined;
    if (!data) {
      throw new GraphQLRequestError("Unexpected response shape from listContentEntries", 200);
    }

    return data;
  }
}

export const ImportEntriesService = Abstraction.createImplementation({
  implementation: ImportEntriesServiceImpl,
  dependencies: [
    GetProjectRepository,
    GetProjectModelRepository,
    CmsManageEndpointClient,
    OperationRegistry,
    CreateSeedEntryRepository,
    Logger,
  ],
});
