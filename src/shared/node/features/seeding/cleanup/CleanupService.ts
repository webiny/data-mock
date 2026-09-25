import { Result, Logger } from "@webiny/stdlib";
import { CleanupService as Abstraction } from "./abstractions/CleanupService.js";
import { EnvironmentContextService } from "~/shared/node/features/environments/context/abstractions/EnvironmentContextService.js";
import { GetProjectModelRepository } from "~/shared/node/features/models/get/abstractions/GetProjectModelRepository.js";
import { ListSeedEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";
import { UpdateSeedEntryStatusRepository } from "~/shared/node/features/seeding/entries/abstractions/UpdateSeedEntryStatusRepository.js";
import { CmsManageEndpointClient } from "~/shared/node/graphql/endpoints/abstractions/CmsManageEndpointClient.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { ModelDependencyResolver } from "~/shared/node/features/seeding/resolve/abstractions/ModelDependencyResolver.js";
import { buildDeleteEntryQuery } from "~/shared/node/graphql/operations/base/revisionOperations.js";
import { GraphQLRequestError, SeedingError, ProjectPersistenceError } from "~/shared/errors.js";
import type { ApiGraphQLResultJson } from "~/shared/node/graphql/abstractions/GraphQLClient.js";
import type { ProjectModel, SeedEntry } from "~/shared/types.js";

const PAGE_SIZE = 100;

interface GraphQLOperation {
  getResult(json: ApiGraphQLResultJson): { data?: unknown; error?: { message: string } };
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

class CleanupServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly environmentContextService: EnvironmentContextService.Interface,
    private readonly getProjectModelRepository: GetProjectModelRepository.Interface,
    private readonly listSeedEntriesRepository: ListSeedEntriesRepository.Interface,
    private readonly updateSeedEntryStatusRepository: UpdateSeedEntryStatusRepository.Interface,
    private readonly cmsManageClient: CmsManageEndpointClient.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
    private readonly modelDependencyResolver: ModelDependencyResolver.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const entriesResult = await this.fetchCreatedEntries(input.environmentId, input.jobId);
    if (entriesResult.isFail()) {
      return Result.fail(entriesResult.error);
    }
    const entries = entriesResult.value;

    // A seed job writes to one tenant, so its entries share one — and with it one token and one
    // set of models.
    const contextResult = await this.environmentContextService.execute({
      environmentId: input.environmentId,
      tenant: entries[0]?.tenant,
    });

    if (contextResult.isFail()) {
      return Result.fail(contextResult.error);
    }

    const { environment, apiUrl, apiToken, tenant, operationsVersion } = contextResult.value;

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
          environmentId: environment.id,
          tenant,
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
      const deleteOperation = this.operationRegistry.resolve("deleteEntry", operationsVersion);

      const modelResults: Abstraction.Output["models"] = [];
      let totalDeleted = 0;
      let totalErrors = 0;
      let totalProcessed = 0;
      const totalEntries = entries.length;
      const onProgress = input.onProgress;

      for (const model of orderedModels) {
        const modelEntries = grouped.get(model.modelId) ?? [];
        const mutation = buildDeleteEntryQuery(model.singularApiName).query;

        let deleted = 0;
        let errors = 0;

        this.logger.info(`Deleting ${modelEntries.length} entries for model "${model.name}"...`);

        for (const entry of modelEntries) {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            authorization: `Bearer ${apiToken}`,
            "x-tenant": entry.tenant,
          };

          const result = await this.sendDelete(
            apiUrl,
            mutation,
            entry.entryId,
            headers,
            deleteOperation,
          );

          if (result.success) {
            deleted++;
            const marked = await this.updateSeedEntryStatusRepository.execute({
              id: entry.id,
              status: "deleted",
            });

            /**
             * The remote entry is gone either way. An unmarked row leaves the next cleanup run
             * trying to delete something that no longer exists and reporting that as a failure.
             */
            if (marked.isFail()) {
              this.logger.warn(
                `Cleanup: deleted entry "${entry.entryId}" but could not mark it deleted: ${marked.error.message}. The next run will try it again.`,
              );
            }
          } else {
            errors++;
            this.logger.warn(
              `Cleanup: failed to delete entry "${entry.entryId}" of model "${model.modelId}": ${result.error}`,
            );
          }

          totalProcessed++;
          if (onProgress) {
            const percent =
              totalEntries > 0
                ? Math.min(100, Math.round((totalProcessed / totalEntries) * 100))
                : 100;
            onProgress(percent, `Deleting entries: ${totalProcessed}/${totalEntries}`);
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
    } catch (error) {
      if (error instanceof GraphQLRequestError || error instanceof SeedingError) {
        return Result.fail(error);
      }
      return Result.fail(
        new SeedingError(error instanceof Error ? error : new Error(String(error))),
      );
    }
  }

  private async fetchCreatedEntries(
    environmentId: string,
    jobId: string | undefined,
  ): Promise<Result<SeedEntry[], ProjectPersistenceError>> {
    const entries: SeedEntry[] = [];
    let offset = 0;

    for (;;) {
      const listInput: ListSeedEntriesRepository.Input = {
        environmentId,
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

    const dependencyResult = this.modelDependencyResolver.execute({ models });
    if (dependencyResult.isFail()) {
      return [...models].reverse();
    }

    return [...dependencyResult.value.ordered].reverse();
  }

  private async sendDelete(
    apiUrl: string,
    mutation: string,
    revision: string,
    headers: Record<string, string>,
    operation: GraphQLOperation,
  ): Promise<DeleteResult> {
    if (!revision) {
      return { success: false, error: "Missing entry revision id" };
    }

    const body = JSON.stringify({ query: mutation, variables: { revision } });
    const response = await this.cmsManageClient.post(apiUrl, body, headers);

    if (response.status !== 200) {
      const text = await response.text().catch(() => "");
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    const json = (await response.json()) as ApiGraphQLResultJson;
    const result = operation.getResult(json);

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  }
}

export const CleanupService = Abstraction.createImplementation({
  implementation: CleanupServiceImpl,
  dependencies: [
    EnvironmentContextService,
    GetProjectModelRepository,
    ListSeedEntriesRepository,
    UpdateSeedEntryStatusRepository,
    CmsManageEndpointClient,
    OperationRegistry,
    ModelDependencyResolver,
    Logger,
  ],
});
