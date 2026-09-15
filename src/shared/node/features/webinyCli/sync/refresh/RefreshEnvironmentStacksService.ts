import { UpdateEnvironmentRepository } from "~/shared/node/features/environments/update/abstractions/UpdateEnvironmentRepository.js";
import { UpsertStackRepository } from "~/shared/node/features/environments/stacks/abstractions/UpsertStackRepository.js";
import { ListStacksRepository } from "~/shared/node/features/environments/stacks/abstractions/ListStacksRepository.js";
import { PulumiCheckpointReader } from "../../checkpoint/abstractions/PulumiCheckpointReader.js";
import { RefreshEnvironmentStacksService as Abstraction } from "./abstractions/RefreshEnvironmentStacksService.js";
import { readAdminUrl, readApiUrl, readRegion } from "~/shared/stackOutput/stackOutputKeyMap.js";
import type { ProjectStack } from "~/shared/types.js";

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

    for (const app of input.apps) {
      const result = this.checkpointReader.read({
        rootPath: input.rootPath,
        app,
        env: environment.env,
        variant: environment.variant,
      });

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
     * The environment row is derived from EVERY stored stack, not just the ones read on this call.
     *
     * A deploy of `api` alone refreshes only `api`. Deriving from that read alone would write a
     * null `adminUrl` over a perfectly good one, and destroying `admin` alone would mark the whole
     * environment not-deployed while core and api are still up. Reading back what is stored makes
     * a partial refresh and a full sync produce the same row.
     */
    const stored = await this.listStacksRepository.execute({ environmentId: environment.id });
    const stacks = stored.isOk() ? stored.value : [];

    const anyDeployed = stacks.some((stack) => stack.deployed);
    const apiUrl = readApiUrl(outputsOf(stacks, "api"));
    const adminUrl = readAdminUrl(outputsOf(stacks, "admin"));
    const region = readRegion(outputsOf(stacks, "api")) ?? readRegion(outputsOf(stacks, "core"));

    await this.updateEnvironmentRepository.execute({
      id: environment.id,
      deployed: anyDeployed,
      apiUrl,
      adminUrl,
      ...(region !== null ? { region } : {}),
      lastSyncedAt: Date.now(),
    });

    return { read, unknown, deployed: anyDeployed };
  }
}

/**
 * The stored output of one app, but only while that app is deployed. A destroyed stack keeps its
 * last output for reference, and reading a URL back out of it would report a torn-down API as live.
 */
function outputsOf(stacks: ProjectStack[], app: string): Record<string, unknown> | null {
  const stack = stacks.find((candidate) => candidate.app === app);
  return stack !== undefined && stack.deployed ? stack.stackOutput : null;
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
