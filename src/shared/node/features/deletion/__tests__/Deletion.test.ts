import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { ListProjectsRepository } from "~/shared/node/features/projects/list/abstractions/ListProjectsRepository.js";
import { ArchiveProjectRepository } from "~/shared/node/features/projects/archive/abstractions/ArchiveProjectRepository.js";
import { CreateEnvironmentRepository } from "~/shared/node/features/environments/create/abstractions/CreateEnvironmentRepository.js";
import { ListEnvironmentsRepository } from "~/shared/node/features/environments/list/abstractions/ListEnvironmentsRepository.js";
import { ArchiveEnvironmentRepository } from "~/shared/node/features/environments/archive/abstractions/ArchiveEnvironmentRepository.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import { DeletionImpactService } from "../impact/abstractions/DeletionImpactService.js";

describe("Deletion safety", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let projectId: string;
  let environmentId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    const createProject = tc.container.resolve(CreateProjectUseCase);
    const result = await createProject.execute({
      name: "Deletion Project",
      apiUrl: "https://api.example.com",
      apiToken: "token",
      tenant: "root",
    });
    if (result.isFail()) {
      throw new Error("Failed to create project");
    }
    projectId = result.value.project.id;
    environmentId = result.value.environment.id;
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("ArchiveProjectRepository", () => {
    it("hides an archived project from the default listing but keeps it readable", async () => {
      const archive = tc.container.resolve(ArchiveProjectRepository);
      const list = tc.container.resolve(ListProjectsRepository);

      const archived = await archive.execute({ id: projectId, archived: true });
      expect(archived.isOk()).toBe(true);

      const hidden = await list.execute();
      expect(hidden.isOk() && hidden.value).toHaveLength(0);

      const shown = await list.execute({ includeArchived: true });
      expect(shown.isOk() && shown.value).toHaveLength(1);
    });

    it("keeps the original archivedAt when archiving twice", async () => {
      const archive = tc.container.resolve(ArchiveProjectRepository);

      const first = await archive.execute({ id: projectId, archived: true });
      const second = await archive.execute({ id: projectId, archived: true });

      expect(first.isOk() && second.isOk()).toBe(true);
      if (first.isOk() && second.isOk()) {
        expect(second.value.archivedAt).toBe(first.value.archivedAt);
      }
    });

    it("restores an archived project", async () => {
      const archive = tc.container.resolve(ArchiveProjectRepository);
      const list = tc.container.resolve(ListProjectsRepository);

      await archive.execute({ id: projectId, archived: true });
      const restored = await archive.execute({ id: projectId, archived: false });

      expect(restored.isOk() && restored.value.archivedAt).toBeNull();

      const projects = await list.execute();
      expect(projects.isOk() && projects.value).toHaveLength(1);
    });

    it("fails for an unknown project", async () => {
      const archive = tc.container.resolve(ArchiveProjectRepository);
      const result = await archive.execute({ id: "nope", archived: true });

      expect(result.isFail()).toBe(true);
    });
  });

  describe("ArchiveEnvironmentRepository", () => {
    it("hides an archived environment but keeps its slot in the unique index", async () => {
      const archive = tc.container.resolve(ArchiveEnvironmentRepository);
      const list = tc.container.resolve(ListEnvironmentsRepository);
      const create = tc.container.resolve(CreateEnvironmentRepository);

      const existing = await list.execute({ projectId });
      const env = existing.isOk() ? existing.value[0] : undefined;
      if (!env) {
        throw new Error("Expected a seeded environment");
      }

      await archive.execute({ id: env.id, archived: true });

      const hidden = await list.execute({ projectId });
      expect(hidden.isOk() && hidden.value).toHaveLength(0);

      const shown = await list.execute({ projectId, includeArchived: true });
      expect(shown.isOk() && shown.value).toHaveLength(1);

      // The archived row still owns (project, env, variant): a re-insert must be rejected rather
      // than quietly creating a second row for the same stack name.
      const duplicate = await create.execute({
        projectId,
        env: env.env,
        variant: env.variant,
      });
      expect(duplicate.isFail()).toBe(true);
    });

    it("keeps the decrypted API token across an archive and restore", async () => {
      const archive = tc.container.resolve(ArchiveEnvironmentRepository);

      const archived = await archive.execute({ id: environmentId, archived: true });
      const restored = await archive.execute({ id: environmentId, archived: false });

      expect(archived.isOk() && archived.value.apiToken).toBe("token");
      expect(restored.isOk() && restored.value.apiToken).toBe("token");
    });
  });

  describe("DeletionImpactService", () => {
    it("counts the rows a project purge would destroy", async () => {
      const syncLogs = tc.container.resolve(CreateSyncLogRepository);
      await syncLogs.execute({
        projectId,
        environmentId,
        type: "tenants",
        status: "success",
        message: "Synced",
      });

      const service = tc.container.resolve(DeletionImpactService);
      const result = await service.execute({ scope: "project", id: projectId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.environments).toBe(1);
        expect(result.value.syncLogs).toBe(1);
        expect(result.value.seedEntries).toBe(0);
      }
    });

    it("reports zero environments and zero seed templates for an environment purge", async () => {
      const service = tc.container.resolve(DeletionImpactService);
      const result = await service.execute({ scope: "environment", id: environmentId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.environments).toBe(0);
        expect(result.value.seedTemplates).toBe(0);
      }
    });

    it("fails for an unknown id", async () => {
      const service = tc.container.resolve(DeletionImpactService);

      expect((await service.execute({ scope: "project", id: "nope" })).isFail()).toBe(true);
      expect((await service.execute({ scope: "environment", id: "nope" })).isFail()).toBe(true);
    });
  });
});
