import { UpdateEnvironmentRepository } from "~/shared/node/features/environments/update/abstractions/UpdateEnvironmentRepository.js";
import { UpsertStackRepository } from "~/shared/node/features/environments/stacks/abstractions/UpsertStackRepository.js";
import { ListStacksRepository } from "~/shared/node/features/environments/stacks/abstractions/ListStacksRepository.js";
import { PulumiCheckpointReader } from "../../checkpoint/abstractions/PulumiCheckpointReader.js";
import { RefreshEnvironmentStacksService as Abstraction } from "./abstractions/RefreshEnvironmentStacksService.js";
import { deriveEnvironmentState } from "~/shared/stackOutput/stackState.js";

/**
 * Re-reads one environment's Pulumi checkpoints and writes what it finds onto `project_stacks` and
 * the environment row.
 *
 * Shared by the full sync and by deploy/destroy, which call it with only the apps they just
 * changed. Keeping it in one place is what stops the two from disagreeing about how `api_url`,
 * `admin_url` and `deployed` are derived.
 */
class RefreshEnvironmentStacksServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly checkpointReader: PulumiCheckpointReader.Interface,
    private readonly upsertStackRepository: UpsertStackRepository.Interface,
    private readonly listStacksRepository: ListStacksRepository.Interface,
    private readonly updateEnvironmentRepository: UpdateEnvironmentRepository.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Abstraction.Output> {
    const { environment } = input;

    let read = 0;
    let unknown = 0;

    const readStack =
      input.readStack ??
      (async (app: string) =>
        this.checkpointReader.read({
          rootPath: input.rootPath,
          app,
          env: environment.env,
          variant: environment.variant,
        }));

    for (const app of input.apps) {
      const result = await readStack(app);

      await this.upsertStackRepository.execute({
        environmentId: environment.id,
        app,
        readState: result.readState,
        deployed: result.deployed,
        resourceCount: result.resourceCount,
        stackOutput: result.outputs,
      });

      if (result.readState === "unknown") {
        unknown += 1;
      } else {
        read += 1;
      }

      input.onApp?.();
    }

    /**
     * Read back what is stored, so a partial refresh and a full sync derive the row from the same
     * set of stacks. `deriveEnvironmentState` is shared with the sync preview, which has to predict
     * exactly what this write will produce.
     */
    const stored = await this.listStacksRepository.execute({ environmentId: environment.id });
    const derived = deriveEnvironmentState(stored.isOk() ? stored.value : []);

    await this.updateEnvironmentRepository.execute({
      id: environment.id,
      deployed: derived.deployed,
      apiUrl: derived.apiUrl,
      adminUrl: derived.adminUrl,
      ...(derived.region !== null ? { region: derived.region } : {}),
      lastSyncedAt: Date.now(),
    });

    return { read, unknown, deployed: derived.deployed };
  }
}

export const RefreshEnvironmentStacksService = Abstraction.createImplementation({
  implementation: RefreshEnvironmentStacksServiceImpl,
  dependencies: [
    PulumiCheckpointReader,
    UpsertStackRepository,
    ListStacksRepository,
    UpdateEnvironmentRepository,
  ],
});
