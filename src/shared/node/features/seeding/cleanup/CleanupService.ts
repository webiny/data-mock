import { Result, Logger } from "@webiny/stdlib";
import { CleanupService as Abstraction } from "./abstractions/CleanupService.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { GetProjectModelRepository } from "~/shared/node/features/models/get/abstractions/GetProjectModelRepository.js";
import { ListSeedEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";
import { UpdateSeedEntryStatusRepository } from "~/shared/node/features/seeding/entries/abstractions/UpdateSeedEntryStatusRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { ModelDependencyResolver } from "~/shared/node/features/seeding/resolve/abstractions/ModelDependencyResolver.js";
import { buildDeleteEntryQuery } from "~/shared/node/graphql/operations/base/revisionOperations.js";
import { GraphQLRequestError, SeedingError, ProjectPersistenceError } from "~/shared/errors.js";
import type { ApiGraphQLResultJson } from "~/shared/node/graphql/abstractions/GraphQLClient.js";
import type { ProjectModel, SeedEntry } from "~/shared/types.js";

const PAGE_SIZE = 100;

interface GqlOp {
  getResult(json: ApiGraphQLResultJson): { data?: unknown; error?: { message: string } };
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

class CleanupServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly getProjectModelRepository: GetProjectModelRepository.Interface,
    private readonly listSeedEntriesRepository: ListSeedEntriesRepository.Interface,
    private readonly updateSeedEntryStatusRepository: UpdateSeedEntryStatusRepository.Interface,
    private readonly httpClient: HttpClient.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
    private readonly modelDependencyResolver: ModelDependencyResolver.Interface,
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

    const entriesResult = await this.fetchCreatedEntries(project.id, input.jobId);
    if (entriesResult.isFail()) {
      return Result.fail(entriesResult.error);
    }
    const entries = entriesResult.value;

    if (entries.length === 0) {
      return Result.ok({ deleted: 0, errors: 0, models: [] });
    }

    try {
      const grouped = new Map<string, SeedEntry[]>();
      for (const entry of entries) {
        const list = grouped.get(entry.modelId) ?? [];
        list.push(entry);
        grouped.set(entry.modelId, list);
      }

      const resolvedModels: ProjectModel[] = [];
      const unresolvedModelIds: string[] = [];

      for (const modelId of grouped.keys()) {
        const modelResult = await this.getProjectModelRepository.execute({
          projectId: project.id,
          modelId,
        });
        if (modelResult.isFail()) {
          this.logger.warn(
            `Cleanup: model "${modelId}" not found locally, skipping ${grouped.get(modelId)?.length ?? 0} entries.`,
          );
          unresolvedModelIds.push(modelId);
          continue;
        }
        resolvedModels.push(modelResult.value);
      }

      const orderedModels = this.reverseDependencyOrder(resolvedModels);
      const deleteOp = this.operationRegistry.resolve("deleteEntry", project.webinyVersion);
      const apiUrl = `${project.apiUrl}${deleteOp.path}`;

      const modelResults: Abstraction.Output["models"] = [];
      let totalDeleted = 0;
      let totalErrors = 0;

      for (const model of orderedModels) {
        const modelEntries = grouped.get(model.modelId) ?? [];
        const mutation = buildDeleteEntryQuery(model.singularApiName).query;

        let deleted = 0;
        let errors = 0;

        this.logger.info(`Deleting ${modelEntries.length} entries for model "${model.name}"...`);

        for (const entry of modelEntries) {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            authorization: `Bearer ${project.apiToken}`,
            "x-tenant": entry.tenant,
          };

          const result = await this.sendDelete(apiUrl, mutation, entry.entryId, headers, deleteOp);

          if (result.success) {
            deleted++;
            await this.updateSeedEntryStatusRepository.execute({ id: entry.id, status: "deleted" });
          } else {
            errors++;
            this.logger.warn(
              `Cleanup: failed to delete entry "${entry.entryId}" of model "${model.modelId}": ${result.error}`,
            );
          }
        }

        modelResults.push({ modelId: model.modelId, deleted, errors });
        totalDeleted += deleted;
        totalErrors += errors;
      }

      for (const modelId of unresolvedModelIds) {
        const count = grouped.get(modelId)?.length ?? 0;
        modelResults.push({ modelId, deleted: 0, errors: count });
        totalErrors += count;
      }

      return Result.ok({ deleted: totalDeleted, errors: totalErrors, models: modelResults });
    } catch (err) {
      if (err instanceof GraphQLRequestError || err instanceof SeedingError) {
        return Result.fail(err);
      }
      return Result.fail(new SeedingError(err instanceof Error ? err : new Error(String(err))));
    }
  }

  private async fetchCreatedEntries(
    projectId: string,
    jobId: string | undefined,
  ): Promise<Result<SeedEntry[], ProjectPersistenceError>> {
    const entries: SeedEntry[] = [];
    let offset = 0;

    for (;;) {
      const listInput: ListSeedEntriesRepository.Input = {
        projectId,
        status: "created",
        limit: PAGE_SIZE,
        offset,
      };
      if (jobId) {
        listInput.jobId = jobId;
      }
      const result = await this.listSeedEntriesRepository.execute(listInput);

      if (result.isFail()) {
        return Result.fail(result.error);
      }

      entries.push(...result.value.entries);
      offset += PAGE_SIZE;

      if (result.value.entries.length === 0 || entries.length >= result.value.total) {
        break;
      }
    }

    return Result.ok(entries);
  }

  private reverseDependencyOrder(models: ProjectModel[]): ProjectModel[] {
    if (models.length === 0) {
      return [];
    }

    const depResult = this.modelDependencyResolver.execute({ models });
    if (depResult.isFail()) {
      return [...models].reverse();
    }

    return [...depResult.value.ordered].reverse();
  }

  private async sendDelete(
    apiUrl: string,
    mutation: string,
    revision: string,
    headers: Record<string, string>,
    op: GqlOp,
  ): Promise<DeleteResult> {
    if (!revision) {
      return { success: false, error: "Missing entry revision id" };
    }

    const body = JSON.stringify({ query: mutation, variables: { revision } });
    const response = await this.httpClient.post(apiUrl, body, headers);

    if (response.status !== 200) {
      const text = await response.text().catch(() => "");
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    const json = (await response.json()) as ApiGraphQLResultJson;
    const result = op.getResult(json);

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  }
}

export const CleanupService = Abstraction.createImplementation({
  implementation: CleanupServiceImpl,
  dependencies: [
    GetProjectRepository,
    GetProjectModelRepository,
    ListSeedEntriesRepository,
    UpdateSeedEntryStatusRepository,
    HttpClient,
    OperationRegistry,
    ModelDependencyResolver,
    Logger,
  ],
});
