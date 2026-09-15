import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { Result } from "@webiny/stdlib";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/ProjectsRepository.js";
import { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import { EnvironmentsRepository } from "~/ui/features/environments/EnvironmentsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import { ProjectListPresenter as ProjectListPresenterAbstraction } from "../abstractions/ProjectListPresenter.js";
import { ProjectListPresenter } from "../ProjectListPresenter.js";
import { LoadProjectsUseCase } from "../useCases/LoadProjects/LoadProjectsUseCase.js";
import { ArchiveProjectUseCase } from "../useCases/ArchiveProject/ArchiveProjectUseCase.js";
import { RestoreProjectUseCase } from "../useCases/RestoreProject/RestoreProjectUseCase.js";
import { PurgeProjectUseCase } from "../useCases/PurgeProject/PurgeProjectUseCase.js";
import type { DeletionImpact, Project } from "~/shared/types.js";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Project One",
    rootPath: "/work/project-one",
    webinyVersion: "6.4.9",
    versionSource: "package-json",
    versionMajor: 6,
    operationsVersion: "6.0.0",
    pulumiBackend: null,
    awsProfile: null,
    awsRegion: null,
    lastSyncedAt: null,
    lastSyncStatus: null,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

const EMPTY_IMPACT: DeletionImpact = {
  environments: 0,
  stacks: 0,
  tenants: 0,
  groups: 0,
  models: 0,
  files: 0,
  seedJobs: 0,
  seedEntries: 0,
  syncLogs: 0,
  jobs: 0,
  seedTemplates: 0,
};

/** Records calls and hands back whatever the test set up. No HTTP. */
class StubProjectsGateway {
  public projects: Project[] = [];
  public impact: DeletionImpact | null = { ...EMPTY_IMPACT, seedEntries: 1674, environments: 2 };
  public impactFails = false;
  public readonly archived: string[] = [];
  public readonly restored: string[] = [];
  public readonly purged: string[] = [];

  public readonly gateway: ProjectsGateway.Interface = {
    list: async () => Result.ok(this.projects),
    getById: async (id) => Result.ok(makeProject({ id })),
    create: async () => Result.ok(makeProject()),
    update: async () => Result.ok(makeProject()),
    archive: async (id) => {
      this.archived.push(id);
      const archived = makeProject({ id, archivedAt: 999 });
      this.projects = this.projects.map((p) => (p.id === id ? archived : p));
      return Result.ok(archived);
    },
    restore: async (id) => {
      this.restored.push(id);
      const restored = makeProject({ id, archivedAt: null });
      this.projects = this.projects.map((p) => (p.id === id ? restored : p));
      return Result.ok(restored);
    },
    purge: async (id) => {
      this.purged.push(id);
      return Result.ok(undefined);
    },
    deletionImpact: async () =>
      this.impactFails || this.impact === null
        ? Result.fail(new Error("boom") as never)
        : Result.ok(this.impact),
    healthCheck: async () => Result.ok({ reachable: true, error: null }),
  };
}

class StubEnvironmentsGateway {
  public readonly synced: string[] = [];
  public readonly previewed: string[] = [];
  public lastPreviewedIds: string[] = [];
  public failSyncFor = new Set<string>();
  public hasChanges = true;

  public readonly gateway: Partial<EnvironmentsGateway.Interface> = {
    listForProject: async () => Result.ok([]),
    listStacks: async () => Result.ok([]),
    sync: async (projectId: string) => {
      this.synced.push(projectId);
      return this.failSyncFor.has(projectId)
        ? Result.fail(new Error("queue full") as never)
        : Result.ok({ id: "job1" } as never);
    },
    previewSync: async (projectIds: string[]) => {
      this.previewed.push(...projectIds);
      this.lastPreviewedIds = projectIds;
      return Result.ok({ id: "preview-job" } as never);
    },
  };
}

/**
 * Answers the preview job with a finished row carrying one preview per project asked for. The
 * dialog polls the job, so nothing about it works without this.
 */
class StubJobsGateway {
  public constructor(private readonly environments: StubEnvironmentsGateway) {}

  public readonly gateway: Partial<JobsGateway.Interface> = {
    getGlobal: async () =>
      Result.ok({
        id: "preview-job",
        status: "completed",
        logs: null,
        progressLabel: null,
        result: {
          previews: this.environments.lastPreviewedIds.map((projectId) => ({
            projectId,
            projectName: `Project ${projectId}`,
            backend: "local",
            hasChanges: this.environments.hasChanges,
            project: [],
            environments: [],
            messages: [],
          })),
          failures: [],
        },
      } as never),
  };
}

class StubNotifications {
  public readonly successes: string[] = [];
  public readonly errors: string[] = [];

  public readonly service: NotificationService.Interface = {
    success: (message: string) => void this.successes.push(message),
    error: (message: string) => void this.errors.push(message),
    warning: () => {},
    info: () => {},
  };
}

describe("ProjectListPresenter", () => {
  let container: Container;
  let projectsGateway: StubProjectsGateway;
  let environmentsGateway: StubEnvironmentsGateway;
  let notifications: StubNotifications;

  beforeEach(() => {
    container = new Container();
    projectsGateway = new StubProjectsGateway();
    environmentsGateway = new StubEnvironmentsGateway();
    notifications = new StubNotifications();

    container.registerInstance(ProjectsGateway, projectsGateway.gateway);
    container.registerInstance(
      EnvironmentsGateway,
      environmentsGateway.gateway as EnvironmentsGateway.Interface,
    );
    container.registerInstance(NotificationService, notifications.service);
    container.registerInstance(
      JobsGateway,
      new StubJobsGateway(environmentsGateway).gateway as JobsGateway.Interface,
    );
    container.register(ProjectsRepository).inSingletonScope();
    container.register(EnvironmentsRepository).inSingletonScope();
    container.register(LoadProjectsUseCase);
    container.register(ArchiveProjectUseCase);
    container.register(RestoreProjectUseCase);
    container.register(PurgeProjectUseCase);
    container.register(ProjectListPresenter);
  });

  /** Lets the enqueue-then-poll chain behind a fire-and-forget open() settle. */
  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function presenter() {
    return container.resolve(ProjectListPresenterAbstraction);
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("splits archived projects out of the main list", async () => {
    projectsGateway.projects = [
      makeProject({ id: "p1", name: "Active" }),
      makeProject({ id: "p2", name: "Gone", archivedAt: 123 }),
    ];

    const p = presenter();
    await p.load();

    expect(p.vm.projects.map((project) => project.name)).toEqual(["Active"]);
    expect(p.vm.archivedProjects.map((project) => project.name)).toEqual(["Gone"]);
    expect(p.vm.isEmpty).toBe(false);
  });

  it("marks a remote-only project as not syncable", async () => {
    projectsGateway.projects = [makeProject({ rootPath: null })];

    const p = presenter();
    await p.load();

    expect(p.vm.projects[0]?.syncable).toBe(false);
    expect(p.vm.syncableCount).toBe(0);
  });

  it("opens the delete confirmation in archive mode with the impact counts", async () => {
    projectsGateway.projects = [makeProject()];

    const p = presenter();
    await p.load();
    p.confirmDelete("p1", "Project One");
    await settle();

    const confirmation = p.vm.deleteConfirmation;
    expect(confirmation.isOpen).toBe(true);
    expect(confirmation.mode).toBe("archive");
    expect(confirmation.impactTotal).toBe(1676);
    expect(confirmation.impact).toEqual([
      { label: "environments", count: 2 },
      { label: "seed entries", count: 1674 },
    ]);
  });

  it("shows no impact lines when the count fails, rather than an empty list", async () => {
    // An empty list would read as "nothing will be lost", which is the opposite of unknown.
    projectsGateway.impactFails = true;
    projectsGateway.projects = [makeProject()];

    const p = presenter();
    await p.load();
    p.confirmDelete("p1", "Project One");
    await settle();

    expect(p.vm.deleteConfirmation.impact).toEqual([]);
    expect(p.vm.deleteConfirmation.isLoadingImpact).toBe(false);
  });

  it("requires an explicit step to reach the permanent delete", async () => {
    projectsGateway.projects = [makeProject()];

    const p = presenter();
    await p.load();
    p.confirmDelete("p1", "Project One");
    expect(p.vm.deleteConfirmation.mode).toBe("archive");

    p.requestPurge();
    expect(p.vm.deleteConfirmation.mode).toBe("purge");
  });

  it("archives without deleting, and keeps the project in the archived list", async () => {
    projectsGateway.projects = [makeProject()];

    const p = presenter();
    await p.load();
    p.confirmDelete("p1", "Project One");
    await p.archive();

    expect(projectsGateway.archived).toEqual(["p1"]);
    expect(projectsGateway.purged).toEqual([]);
    expect(p.vm.projects).toHaveLength(0);
    expect(p.vm.archivedProjects).toHaveLength(1);
    expect(notifications.successes[0]).toContain("archived");
  });

  it("restores an archived project back into the main list", async () => {
    projectsGateway.projects = [makeProject({ archivedAt: 123 })];

    const p = presenter();
    await p.load();
    await p.restore("p1");

    expect(projectsGateway.restored).toEqual(["p1"]);
    expect(p.vm.projects).toHaveLength(1);
    expect(p.vm.archivedProjects).toHaveLength(0);
  });

  it("purges only from the purge step, and drops the project entirely", async () => {
    projectsGateway.projects = [makeProject()];

    const p = presenter();
    await p.load();
    p.confirmDelete("p1", "Project One");
    p.requestPurge();
    await p.purge();

    expect(projectsGateway.purged).toEqual(["p1"]);
    expect(p.vm.projects).toHaveLength(0);
    expect(p.vm.archivedProjects).toHaveLength(0);
  });

  it("closes the confirmation on cancel without touching anything", async () => {
    projectsGateway.projects = [makeProject()];

    const p = presenter();
    await p.load();
    p.confirmDelete("p1", "Project One");
    p.cancelDelete();

    expect(p.vm.deleteConfirmation.isOpen).toBe(false);
    expect(projectsGateway.archived).toEqual([]);
    expect(projectsGateway.purged).toEqual([]);
  });

  it("syncs every project with a checkout, and no others", async () => {
    projectsGateway.projects = [
      makeProject({ id: "p1" }),
      makeProject({ id: "p2", rootPath: null }),
      makeProject({ id: "p3", archivedAt: 5 }),
    ];

    const p = presenter();
    await p.load();
    p.syncAll();
    await flush();

    // Only the project with a checkout is previewed, so only it can be stored.
    expect(environmentsGateway.previewed).toEqual(["p1"]);

    await p.applySync();

    expect(environmentsGateway.synced).toEqual(["p1"]);
  });

  it("reports how many syncs could not be queued", async () => {
    projectsGateway.projects = [makeProject({ id: "p1" }), makeProject({ id: "p2" })];
    environmentsGateway.failSyncFor.add("p2");

    const p = presenter();
    await p.load();
    p.syncAll();
    await flush();
    await p.applySync();

    expect(notifications.errors[0]).toContain("1 could not be queued");
  });

  it("shows what a sync would change and stores nothing until it is applied", async () => {
    projectsGateway.projects = [makeProject({ id: "p1" })];

    const p = presenter();
    await p.load();
    p.syncProject("p1");
    await flush();

    expect(environmentsGateway.previewed).toEqual(["p1"]);
    expect(p.vm.syncPreview.isOpen).toBe(true);
    expect(environmentsGateway.synced).toEqual([]);

    await p.applySync();

    expect(environmentsGateway.synced).toEqual(["p1"]);
    expect(p.vm.syncPreview.isOpen).toBe(false);
  });

  it("syncs nothing when the diff is dismissed", async () => {
    projectsGateway.projects = [makeProject({ id: "p1" })];

    const p = presenter();
    await p.load();
    p.syncProject("p1");
    await flush();
    p.closeSyncPreview();
    await p.applySync();

    expect(environmentsGateway.synced).toEqual([]);
    expect(p.vm.syncPreview.isOpen).toBe(false);
  });

  it("keeps the diff open and reports the failure when the sync cannot be queued", async () => {
    projectsGateway.projects = [makeProject({ id: "p1" })];
    environmentsGateway.failSyncFor.add("p1");

    const p = presenter();
    await p.load();
    p.syncProject("p1");
    await flush();
    await p.applySync();

    expect(p.vm.syncPreview.isOpen).toBe(true);
    expect(p.vm.syncPreview.error).toContain("queue full");
  });
});
