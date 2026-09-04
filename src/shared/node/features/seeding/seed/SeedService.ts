import { Result, Logger } from "@webiny/stdlib";
import { SeedService as Abstraction } from "./abstractions/SeedService.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { GetProjectModelRepository } from "~/shared/node/features/models/get/abstractions/GetProjectModelRepository.js";
import { GeneratorRegistry } from "~/shared/node/generators/abstractions/GeneratorRegistry.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { CmsManageEndpointClient } from "~/shared/node/graphql/endpoints/abstractions/CmsManageEndpointClient.js";
import { CreateSeedJobRepository } from "~/shared/node/features/seeding/create/abstractions/CreateSeedJobRepository.js";
import { UpdateSeedJobRepository } from "~/shared/node/features/seeding/update/abstractions/UpdateSeedJobRepository.js";
import { ModelDependencyResolver } from "~/shared/node/features/seeding/resolve/abstractions/ModelDependencyResolver.js";
import { CreateSeedEntryRepository } from "~/shared/node/features/seeding/entries/abstractions/CreateSeedEntryRepository.js";
import { ListSeedEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";
import { LoadFilePoolService } from "~/shared/node/features/files/pool/abstractions/LoadFilePoolService.js";
import { createSingleEntryVariables } from "~/shared/node/generators/createEntryVariables.js";
import { createModelFields } from "~/shared/node/fields/createModelFields.js";
import { buildCreateEntryQuery } from "~/shared/node/graphql/operations/base/createContentEntry.js";
import {
  buildCreateRevisionQuery,
  buildPublishQuery,
  buildUnpublishQuery,
} from "~/shared/node/graphql/operations/base/revisionOperations.js";
import { SeedingError } from "~/shared/errors.js";
import type { IHttpResponse } from "~/shared/abstractions/HttpClient.js";
import type { ApiGraphQLResultJson } from "~/shared/node/graphql/abstractions/GraphQLClient.js";
import type { ProjectModel, ProjectFile, Revisions, PublishStrategy } from "~/shared/types.js";

interface ModelSeedContext {
  model: ProjectModel;
  amount: number;
  modelId: string;
  revisions: Revisions;
}

interface EntryMutationRequest {
  url: string;
  mutation: string;
  variables: Record<string, unknown>;
  headers: Record<string, string>;
}

interface EntryMutationResult {
  entryId: string;
  request: EntryMutationRequest;
  responseBody: string | null;
  httpStatus: number;
  status: "created" | "failed";
  error: string | null;
}

interface GqlOp {
  getResult(json: ApiGraphQLResultJson): { data?: unknown; error?: { message: string } };
}

function resolveRevisionCount(revisions: Revisions): number {
  if (typeof revisions === "number") {
    return revisions;
  }
  return Math.floor(Math.random() * (revisions.max - revisions.min + 1)) + revisions.min;
}

class SeedServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly getProjectModelRepository: GetProjectModelRepository.Interface,
    private readonly generatorRegistry: GeneratorRegistry.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
    private readonly cmsManageClient: CmsManageEndpointClient.Interface,
    private readonly createSeedJobRepository: CreateSeedJobRepository.Interface,
    private readonly updateSeedJobRepository: UpdateSeedJobRepository.Interface,
    private readonly modelDependencyResolver: ModelDependencyResolver.Interface,
    private readonly createSeedEntryRepository: CreateSeedEntryRepository.Interface,
    private readonly listSeedEntriesRepository: ListSeedEntriesRepository.Interface,
    private readonly loadFilePoolService: LoadFilePoolService.Interface,
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

    const jobResult = await this.createSeedJobRepository.execute({
      projectId: project.id,
      config: {
        models: input.models,
        publishStrategy: input.publishStrategy,
        publishPercent: input.publishPercent,
        includeUnpublish: input.includeUnpublish,
      },
    });

    if (jobResult.isFail()) {
      return Result.fail(new SeedingError(new Error(jobResult.error.message)));
    }

    const job = jobResult.value;
    let totalCreated = 0;
    const errors: Abstraction.ModelError[] = [];
    const isDryRun = input.dryRun === true;
    const generatedEntries: Abstraction.GeneratedModelEntries[] = [];
    const publishStrategy = input.publishStrategy ?? "none";
    const publishPercent = input.publishPercent ?? 50;
    const includeUnpublish = input.includeUnpublish ?? false;
    const batchSize = input.batchSize;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${project.apiToken}`,
      "x-tenant": input.tenant,
    };

    try {
      const contexts = await this.resolveModels(input, project.id, errors);
      const orderedContexts = this.orderByDependencies(contexts);

      const availableRefs = new Map<string, string[]>();

      await this.preloadExistingRefs(project.id, availableRefs);

      const filePoolResult = await this.loadFilePoolService.execute({
        projectId: project.id,
        tenant: input.tenant,
      });
      const filePool = filePoolResult.isOk() ? filePoolResult.value.filePool : [];
      if (filePool.length > 0) {
        this.logger.info(`Loaded ${filePool.length} file(s) for file pool.`);
      }

      const signal = input.signal;

      for (const ctx of orderedContexts) {
        if (signal?.aborted) {
          this.logger.info("Job cancelled — stopping before next model.");
          break;
        }

        const modelErrors: string[] = [];

        this.logger.info(
          `${isDryRun ? "[DRY RUN] " : ""}Generating ${ctx.amount} entries for model "${ctx.model.name}"...`,
        );

        if (isDryRun) {
          const dryRunEntries = await this.seedDryRun(
            ctx,
            availableRefs,
            job.id,
            project.id,
            input.tenant,
            filePool,
          );
          generatedEntries.push({ modelId: ctx.modelId, entries: dryRunEntries });
          totalCreated += dryRunEntries.length;
          continue;
        }

        const fieldSelection = createModelFields(ctx.model.fields);
        const singularApiName = ctx.model.singularApiName;
        const createMutation = buildCreateEntryQuery({ singularApiName, fieldSelection }).query;
        const revisionMutation = buildCreateRevisionQuery({
          singularApiName,
          fieldSelection,
        }).query;
        const publishMutation = buildPublishQuery(singularApiName).query;
        const unpublishMutation = buildUnpublishQuery(singularApiName).query;
        const createOp = this.operationRegistry.resolve(
          "createContentEntry",
          project.webinyVersion,
        );
        const revisionOp = this.operationRegistry.resolve("createRevision", project.webinyVersion);
        const publishOp = this.operationRegistry.resolve("publishEntry", project.webinyVersion);
        const unpublishOp = this.operationRegistry.resolve("unpublishEntry", project.webinyVersion);
        const apiUrl = project.apiUrl;

        let modelFailed = false;
        for (
          let batchStart = 0;
          batchStart < ctx.amount && !modelFailed && !signal?.aborted;
          batchStart += batchSize
        ) {
          const batchEnd = Math.min(batchStart + batchSize, ctx.amount);
          const batchEntries: Record<string, unknown>[] = [];

          for (let i = batchStart; i < batchEnd; i++) {
            const entry = await createSingleEntryVariables(
              this.generatorRegistry,
              { fields: ctx.model.fields },
              availableRefs,
              filePool,
            );
            batchEntries.push(entry.values as Record<string, unknown>);
          }

          const batchResults = await Promise.all(
            batchEntries.map((entryData) =>
              this.sendMutation(
                apiUrl,
                createMutation,
                { data: { values: entryData } },
                headers,
                createOp,
              ).then((result) => ({ entryData, result })),
            ),
          );

          const failed: typeof batchResults = [];
          const succeeded: typeof batchResults = [];
          for (const entry of batchResults) {
            if (entry.result.error) {
              failed.push(entry);
            } else {
              succeeded.push(entry);
            }
          }

          for (const { entryData, result: created } of failed) {
            modelErrors.push(created.error!);
            errors.push({ modelId: ctx.modelId, message: created.error! });
            await this.logEntry(job.id, project.id, input.tenant, ctx.modelId, entryData, created);
          }

          if (failed.length > 0) {
            modelFailed = true;
          }

          for (const { result: created } of succeeded) {
            if (created.entryId) {
              const refs = availableRefs.get(ctx.model.modelId) ?? [];
              refs.push(created.entryId);
              availableRefs.set(ctx.model.modelId, refs);
            }
          }

          const postProcessResults = await Promise.all(
            succeeded.map(async ({ entryData, result: created }) => {
              await this.logEntry(
                job.id,
                project.id,
                input.tenant,
                ctx.modelId,
                entryData,
                created,
              );

              let entryCreatedCount = 1;
              const entryErrors: Abstraction.ModelError[] = [];
              const revisionCount = resolveRevisionCount(ctx.revisions);
              let latestRevisionId = created.entryId;

              for (let rev = 1; rev < revisionCount; rev++) {
                const revEntry = await createSingleEntryVariables(
                  this.generatorRegistry,
                  { fields: ctx.model.fields },
                  availableRefs,
                  filePool,
                );
                const revData = revEntry.values as Record<string, unknown>;

                const revResult = await this.sendMutation(
                  apiUrl,
                  revisionMutation,
                  { revision: latestRevisionId, data: { values: revData } },
                  headers,
                  revisionOp,
                );

                await this.logEntry(
                  job.id,
                  project.id,
                  input.tenant,
                  ctx.modelId,
                  revData,
                  revResult,
                );

                if (revResult.error) {
                  entryErrors.push({
                    modelId: ctx.modelId,
                    message: `Revision ${rev + 1}: ${revResult.error}`,
                  });
                } else if (revResult.entryId) {
                  latestRevisionId = revResult.entryId;
                  entryCreatedCount++;
                }
              }

              await this.applyPublishStrategy(
                apiUrl,
                publishMutation,
                unpublishMutation,
                headers,
                publishOp,
                unpublishOp,
                created.entryId,
                latestRevisionId,
                publishStrategy,
                publishPercent,
                includeUnpublish,
              );

              return { created: entryCreatedCount, errors: entryErrors };
            }),
          );

          for (const result of postProcessResults) {
            totalCreated += result.created;
            errors.push(...result.errors);
          }
        }

        this.logger.info(
          `Completed model "${ctx.model.name}": ${ctx.amount} attempted, ${modelErrors.length} errors.`,
        );
      }

      const status = isDryRun
        ? "dry-run"
        : errors.length === 0
          ? "completed"
          : totalCreated > 0
            ? "completed"
            : "failed";

      await this.updateSeedJobRepository.execute({
        id: job.id,
        status,
        result: {
          created: totalCreated,
          errors: errors.map((e) => ({ message: e.message, code: "SEED_ERROR" })),
        },
      });

      return Result.ok({
        jobId: job.id,
        created: totalCreated,
        errors,
        dryRun: isDryRun,
        generatedEntries: isDryRun ? generatedEntries : undefined,
      });
    } catch (err) {
      await this.updateSeedJobRepository.execute({
        id: job.id,
        status: "failed",
        result: {
          created: totalCreated,
          errors: [{ message: err instanceof Error ? err.message : String(err), code: "FATAL" }],
        },
      });

      return Result.fail(new SeedingError(err instanceof Error ? err : new Error(String(err))));
    }
  }

  private async resolveModels(
    input: Abstraction.Input,
    projectId: string,
    errors: Abstraction.ModelError[],
  ): Promise<ModelSeedContext[]> {
    const contexts: ModelSeedContext[] = [];
    for (const mc of input.models) {
      const r = await this.getProjectModelRepository.execute({ projectId, modelId: mc.modelId });
      if (r.isFail()) {
        errors.push({ modelId: mc.modelId, message: r.error.message });
        continue;
      }
      contexts.push({
        model: r.value,
        amount: mc.amount,
        modelId: mc.modelId,
        revisions: mc.revisions ?? 1,
      });
    }
    return contexts;
  }

  private orderByDependencies(contexts: ModelSeedContext[]): ModelSeedContext[] {
    const models = contexts.map((c) => c.model);
    const depResult = this.modelDependencyResolver.execute({ models });
    if (depResult.isFail()) {
      return contexts;
    }

    if (depResult.value.circular.length > 0) {
      for (const cycle of depResult.value.circular) {
        this.logger.warn(
          `Circular dependency detected: ${cycle.join(" → ")}. Self-refs will resolve progressively.`,
        );
      }
    }

    const contextByModelId = new Map(contexts.map((c) => [c.model.modelId, c]));
    return depResult.value.ordered
      .map((m) => contextByModelId.get(m.modelId))
      .filter((c): c is ModelSeedContext => c !== undefined);
  }

  private async sendMutation(
    apiUrl: string,
    mutation: string,
    variables: Record<string, unknown>,
    headers: Record<string, string>,
    op: GqlOp,
  ): Promise<EntryMutationResult> {
    const safeHeaders = { ...headers };
    if (safeHeaders["authorization"]) {
      safeHeaders["authorization"] = "[REDACTED]";
    }
    const request: EntryMutationRequest = {
      url: apiUrl,
      mutation,
      variables,
      headers: safeHeaders,
    };
    const body = JSON.stringify({ query: mutation, variables });

    let response: IHttpResponse;
    let rawBody: string;
    const maxRetries = 3;

    for (let attempt = 0; ; attempt++) {
      response = await this.cmsManageClient.post(apiUrl, body, headers);
      rawBody = await response.text().catch(() => "");

      if (response.status === 429 && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        this.logger.warn(
          `HTTP ${response.status} on attempt ${attempt + 1}, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }

    if (response.status !== 200) {
      return {
        entryId: "",
        request,
        responseBody: rawBody,
        httpStatus: response.status,
        status: "failed",
        error: `HTTP ${response.status}: ${rawBody}`,
      };
    }

    let json: ApiGraphQLResultJson;
    try {
      json = JSON.parse(rawBody) as ApiGraphQLResultJson;
    } catch {
      return {
        entryId: "",
        request,
        responseBody: rawBody,
        httpStatus: 200,
        status: "failed",
        error: `Invalid JSON response: ${rawBody.slice(0, 200)}`,
      };
    }

    const result = op.getResult(json);

    if (result.error) {
      return {
        entryId: "",
        request,
        responseBody: rawBody,
        httpStatus: 200,
        status: "failed",
        error: result.error.message,
      };
    }

    const data = result.data as Record<string, unknown> | undefined;
    const nested = (data?.["data"] as Record<string, unknown>) ?? data;
    const entryId = nested && typeof nested["id"] === "string" ? (nested["id"] as string) : "";

    return {
      entryId,
      request,
      responseBody: rawBody,
      httpStatus: 200,
      status: "created",
      error: null,
    };
  }

  private async applyPublishStrategy(
    apiUrl: string,
    publishMutation: string,
    unpublishMutation: string,
    headers: Record<string, string>,
    publishOp: GqlOp,
    unpublishOp: GqlOp,
    firstRevisionId: string,
    lastRevisionId: string,
    strategy: PublishStrategy,
    percent: number,
    includeUnpublish: boolean,
  ): Promise<void> {
    if (strategy === "none" || !firstRevisionId) {
      return;
    }

    let shouldPublish = false;
    let revisionToPublish = lastRevisionId;

    switch (strategy) {
      case "all":
        shouldPublish = true;
        revisionToPublish = lastRevisionId;
        break;
      case "random":
        shouldPublish = Math.random() * 100 < percent;
        revisionToPublish = lastRevisionId;
        break;
      case "first":
        shouldPublish = true;
        revisionToPublish = firstRevisionId;
        break;
      case "last":
        shouldPublish = true;
        revisionToPublish = lastRevisionId;
        break;
    }

    if (!shouldPublish) {
      return;
    }

    await this.sendMutation(
      apiUrl,
      publishMutation,
      { revision: revisionToPublish },
      headers,
      publishOp,
    );

    if (includeUnpublish && Math.random() < 0.3) {
      await this.sendMutation(
        apiUrl,
        unpublishMutation,
        { revision: revisionToPublish },
        headers,
        unpublishOp,
      );
    }
  }

  private async preloadExistingRefs(
    projectId: string,
    availableRefs: Map<string, string[]>,
  ): Promise<void> {
    let totalLoaded = 0;
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const result = await this.listSeedEntriesRepository.execute({
        projectId,
        limit: pageSize,
        offset,
      });
      if (result.isFail()) {
        return;
      }

      for (const entry of result.value.entries) {
        if (!entry.entryId) {
          continue;
        }
        const refs = availableRefs.get(entry.modelId) ?? [];
        refs.push(entry.entryId);
        availableRefs.set(entry.modelId, refs);
        totalLoaded++;
      }

      if (result.value.entries.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    if (totalLoaded > 0) {
      this.logger.info(
        `Pre-loaded ${totalLoaded} existing entry ref(s) across ${availableRefs.size} model(s).`,
      );
    }
  }

  private async logEntry(
    jobId: string,
    projectId: string,
    tenant: string,
    modelId: string,
    entryData: Record<string, unknown>,
    result: EntryMutationResult,
  ): Promise<void> {
    await this.createSeedEntryRepository.execute({
      jobId,
      projectId,
      tenant,
      modelId,
      entryId: result.entryId,
      entryData,
      requestData: result.request as unknown as Record<string, unknown>,
      responseData: result.responseBody,
      httpStatus: result.httpStatus,
      status: result.status,
      error: result.error,
    });
  }

  private async seedDryRun(
    ctx: ModelSeedContext,
    availableRefs: Map<string, string[]>,
    jobId: string,
    projectId: string,
    tenant: string,
    filePool: ProjectFile[],
  ): Promise<Record<string, unknown>[]> {
    const entries: Record<string, unknown>[] = [];
    for (let i = 0; i < ctx.amount; i++) {
      const entry = await createSingleEntryVariables(
        this.generatorRegistry,
        { fields: ctx.model.fields },
        availableRefs,
        filePool,
      );
      const entryData = entry.values as Record<string, unknown>;
      entries.push(entryData);
      await this.createSeedEntryRepository.execute({
        jobId,
        projectId,
        tenant,
        modelId: ctx.modelId,
        entryId: "",
        entryData,
        requestData: null,
        responseData: null,
        httpStatus: null,
        status: "dry-run",
        error: null,
      });
    }
    this.logger.info(
      `[DRY RUN] Generated ${entries.length} entries for model "${ctx.model.name}" (not sent).`,
    );
    return entries;
  }
}

export const SeedService = Abstraction.createImplementation({
  implementation: SeedServiceImpl,
  dependencies: [
    GetProjectRepository,
    GetProjectModelRepository,
    GeneratorRegistry,
    OperationRegistry,
    CmsManageEndpointClient,
    CreateSeedJobRepository,
    UpdateSeedJobRepository,
    ModelDependencyResolver,
    CreateSeedEntryRepository,
    ListSeedEntriesRepository,
    LoadFilePoolService,
    Logger,
  ],
});
