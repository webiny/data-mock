import { Logger } from "@webiny/stdlib";
import { ListProjectsRepository } from "~/shared/node/features/projects/list/abstractions/ListProjectsRepository.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { SyncScheduler as Abstraction } from "./abstractions/SyncScheduler.js";

/**
 * Enqueues the periodic sync. It only ever enqueues — it never syncs.
 *
 * Running the sync directly would let a scheduled tick read a checkpoint that a deploy is halfway
 * through rewriting: a valid file with partial `resources` and stale outputs, which would make
 * `resource_count` flap and blank the System Info panel. Going through the queue puts the sync
 * behind whatever that project is already doing.
 *
 * A project that already has a `sync-system` job pending or running is skipped, so a slow sync on
 * a large checkout cannot accumulate a queue of identical jobs behind it.
 */
class SyncSchedulerImpl implements Abstraction.Interface {
  public constructor(
    private readonly listProjectsRepository: ListProjectsRepository.Interface,
    private readonly jobWorker: JobWorker.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(): Promise<Abstraction.Result> {
    const enqueued: string[] = [];
    const skipped: Array<{ projectId: string; reason: string }> = [];

    // Archived projects are excluded by the default listing, which is what we want: archiving is
    // "stop tracking this", and a scheduled sync would keep touching it.
    const projectsResult = await this.listProjectsRepository.execute();
    if (projectsResult.isFail()) {
      this.logger.error(`Scheduled sync could not list projects: ${projectsResult.error.message}`);
      return { enqueued, skipped };
    }

    for (const project of projectsResult.value) {
      if (project.rootPath === null) {
        skipped.push({ projectId: project.id, reason: "no local checkout" });
        continue;
      }

      if (await this.hasActiveSync(project.id)) {
        skipped.push({ projectId: project.id, reason: "a sync is already queued" });
        continue;
      }

      enqueued.push(await this.jobWorker.enqueue({ projectId: project.id, type: "sync-system" }));
    }

    if (enqueued.length > 0) {
      this.logger.info(`Scheduled sync enqueued ${enqueued.length} job(s).`);
    }

    return { enqueued, skipped };
  }

  private async hasActiveSync(projectId: string): Promise<boolean> {
    for (const status of ["pending", "running"]) {
      const { total } = await this.jobWorker.listJobs({
        projectId,
        type: "sync-system",
        status,
        limit: 1,
      });

      if (total > 0) {
        return true;
      }
    }

    return false;
  }
}

export const SyncScheduler = Abstraction.createImplementation({
  implementation: SyncSchedulerImpl,
  dependencies: [ListProjectsRepository, JobWorker, Logger],
});
