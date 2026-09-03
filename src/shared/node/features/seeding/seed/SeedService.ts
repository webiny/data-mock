import { Result, Logger } from "@webiny/stdlib";
import { SeedService as Abstraction } from "./abstractions/SeedService.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { GetProjectModelRepository } from "~/shared/node/features/models/get/abstractions/GetProjectModelRepository.js";
import { GeneratorRegistry } from "~/shared/node/generators/abstractions/GeneratorRegistry.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { CreateSeedJobRepository } from "~/shared/node/features/seeding/create/abstractions/CreateSeedJobRepository.js";
import { UpdateSeedJobRepository } from "~/shared/node/features/seeding/update/abstractions/UpdateSeedJobRepository.js";
import { createEntryVariables } from "~/shared/node/generators/createEntryVariables.js";
import { createModelFields } from "~/shared/node/fields/createModelFields.js";
import { buildCreateEntryQuery } from "~/shared/node/graphql/operations/base/createContentEntry.js";
import { SeedingError } from "~/shared/errors.js";
import type { ApiGraphQLResultJson } from "~/shared/node/graphql/abstractions/GraphQLClient.js";

class SeedServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly getProjectModelRepository: GetProjectModelRepository.Interface,
    private readonly generatorRegistry: GeneratorRegistry.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
    private readonly httpClient: HttpClient.Interface,
    private readonly createSeedJobRepository: CreateSeedJobRepository.Interface,
    private readonly updateSeedJobRepository: UpdateSeedJobRepository.Interface,
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
      config: { models: input.models },
    });

    if (jobResult.isFail()) {
      return Result.fail(new SeedingError(new Error(jobResult.error.message)));
    }

    const job = jobResult.value;
    let totalCreated = 0;
    const errors: Array<{ modelId: string; message: string }> = [];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${project.apiToken}`,
      "x-tenant": input.tenant,
    };

    try {
      for (const modelConfig of input.models) {
        const modelResult = await this.getProjectModelRepository.execute({
          projectId: project.id,
          modelId: modelConfig.modelId,
        });

        if (modelResult.isFail()) {
          errors.push({ modelId: modelConfig.modelId, message: modelResult.error.message });
          continue;
        }

        const model = modelResult.value;

        this.logger.info(`Generating ${modelConfig.amount} entries for model "${model.name}"...`);

        const entries = await createEntryVariables(
          this.generatorRegistry,
          this.logger,
          { fields: model.fields },
          modelConfig.amount,
        );

        const fieldSelection = createModelFields(model.fields);
        const mutation = buildCreateEntryQuery({
          singularApiName: model.modelId.charAt(0).toUpperCase() + model.modelId.slice(1),
          fieldSelection,
        });

        const createOp = this.operationRegistry.resolve(
          "createContentEntry",
          project.webinyVersion,
        );
        const apiUrl = `${project.apiUrl}${createOp.path}`;

        for (let i = 0; i < entries.length; i++) {
          try {
            const body = JSON.stringify({
              query: mutation,
              variables: { data: entries[i]!.values },
            });

            const response = await this.httpClient.post(apiUrl, body, headers);

            if (response.status !== 200) {
              const text = await response.text().catch(() => "");
              errors.push({
                modelId: modelConfig.modelId,
                message: `HTTP ${response.status}: ${text}`,
              });
              continue;
            }

            const json = (await response.json()) as ApiGraphQLResultJson;
            const result = createOp.getResult(json);

            if (result.error) {
              errors.push({
                modelId: modelConfig.modelId,
                message: result.error.message,
              });
            } else {
              totalCreated++;
            }
          } catch (err) {
            errors.push({
              modelId: modelConfig.modelId,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }

        this.logger.info(
          `Completed model "${model.name}": ${entries.length} attempted, ${errors.length} errors.`,
        );
      }

      const status = errors.length === 0 ? "completed" : totalCreated > 0 ? "completed" : "failed";

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
}

export const SeedService = Abstraction.createImplementation({
  implementation: SeedServiceImpl,
  dependencies: [
    GetProjectRepository,
    GetProjectModelRepository,
    GeneratorRegistry,
    OperationRegistry,
    HttpClient,
    CreateSeedJobRepository,
    UpdateSeedJobRepository,
    Logger,
  ],
});
