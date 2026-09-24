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

      const stored = await this.upsertStackRepository.execute({
        environmentId: environment.id,
        app,
        readState: result.readState,
        deployed: result.deployed,
        resourceCount: result.resourceCount,
        stackOutput: result.outputs,
      });

      /**
       * A stack that was read but could not be stored counts as unknown, not as read. The caller
       * turns that count into the sync's "partial" status, and calling a lost write a success
       * would report an inventory that was never written.
       */
      if (result.readState === "unknown" || stored.isFail()) {
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

    /**
     * A read that failed is not an environment with no stacks. Deriving from an empty list would
     * write `deployed: false` with no `api_url` and no `admin_url` — a live environment recorded
     * as never deployed, off the back of one failed select. The row keeps what it had, and the
     * stacks count as unknown so the sync reports itself as partial.
     */
    if (stored.isFail()) {
      return { read: 0, unknown: read + unknown, deployed: environment.deployed };
    }

    const derived = deriveEnvironmentState(stored.value);

    const updated = await this.updateEnvironmentRepository.execute({
      id: environment.id,
      deployed: derived.deployed,
      apiUrl: derived.apiUrl,
      adminUrl: derived.adminUrl,
      ...(derived.region !== null ? { region: derived.region } : {}),
      lastSyncedAt: Date.now(),
    });

    // A derivation that could not be stored is not a refreshed environment either.
    if (updated.isFail()) {
      return { read: 0, unknown: read + unknown, deployed: environment.deployed };
    }

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
