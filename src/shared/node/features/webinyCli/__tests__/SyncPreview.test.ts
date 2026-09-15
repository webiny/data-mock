import { describe, it, expect } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { SyncPreviewService } from "../sync/preview/abstractions/SyncPreviewService.js";
import { SyncSystemService } from "../sync/abstractions/SyncSystemService.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UpdateProjectRepository } from "~/shared/node/features/projects/update/abstractions/UpdateProjectRepository.js";
import { ArchiveEnvironmentRepository } from "~/shared/node/features/environments/archive/abstractions/ArchiveEnvironmentRepository.js";
import { ListEnvironmentsRepository } from "~/shared/node/features/environments/list/abstractions/ListEnvironmentsRepository.js";
import { createFixtureProject, stackResource } from "./fixtures.js";
import type { SyncPreviewResponse } from "~/shared/responses/sync.js";

function withContainer<T>(fn: (tc: ReturnType<typeof createTestContainer>) => Promise<T> | T) {
  const tc = createTestContainer();
  return Promise.resolve(fn(tc)).finally(() => tc.cleanup());
}

const V6 = { "@webiny/cli": "6.4.9" };

async function registerProject(
  tc: ReturnType<typeof createTestContainer>,
  rootPath: string,
): Promise<string> {
  const created = await tc.container
    .resolve(CreateProjectUseCase)
    .execute({ name: "Preview Project", rootPath, env: "dev" });

  if (created.isFail()) {
    throw new Error("Failed to create project");
  }

  // CreateProjectUseCase records the path it was given; the detector needs it on the row.
  await tc.container
    .resolve(UpdateProjectRepository)
    .execute({ id: created.value.project.id, rootPath });

  return created.value.project.id;
}

function environmentNamed(preview: SyncPreviewResponse, stackName: string) {
  const found = preview.environments.find((environment) => environment.stackName === stackName);
  if (found === undefined) {
    throw new Error(`No environment "${stackName}" in the preview`);
  }
  return found;
}

describe("SyncPreviewService", () => {
  it("reports the version a sync would store, and stores nothing", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: V6 },
      stacks: [{ app: "core", stackName: "dev", resources: [stackResource({})] }],
    });

    try {
      await withContainer(async (tc) => {
        const projectId = await registerProject(tc, fixture.rootPath);

        const result = await tc.container.resolve(SyncPreviewService).execute({ projectId });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
          return;
        }

        expect(result.value.hasChanges).toBe(true);
        expect(result.value.backend).toBe("local");
        expect(result.value.project).toContainEqual(
          expect.objectContaining({ field: "webinyVersion", current: null, incoming: "6.4.9" }),
        );

        // Nothing was written: the version on the row is still unset.
        const preview = result.value;
        const second = await tc.container.resolve(SyncPreviewService).execute({ projectId });
        expect(second.isOk() && second.value.project).toEqual(preview.project);
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("reports nothing to change once the sync has been applied", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: V6 },
      stacks: [
        {
          app: "core",
          stackName: "dev",
          resources: [stackResource({ "webiny-api-url": "https://api.example.com" })],
        },
      ],
    });

    try {
      await withContainer(async (tc) => {
        const projectId = await registerProject(tc, fixture.rootPath);

        await tc.container.resolve(SyncSystemService).execute({ projectId });

        const result = await tc.container.resolve(SyncPreviewService).execute({ projectId });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
          return;
        }

        expect(result.value.project).toEqual([]);
        expect(result.value.hasChanges).toBe(false);
        expect(environmentNamed(result.value, "dev").change).toBe("unchanged");
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("lists an environment found on disk as new", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: V6 },
      stacks: [
        { app: "core", stackName: "dev", resources: [stackResource({})] },
        { app: "core", stackName: "prod", resources: [stackResource({})] },
      ],
    });

    try {
      await withContainer(async (tc) => {
        const projectId = await registerProject(tc, fixture.rootPath);

        const result = await tc.container.resolve(SyncPreviewService).execute({ projectId });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
          return;
        }

        expect(environmentNamed(result.value, "prod").change).toBe("added");

        // Still only the one environment created with the project.
        const stored = await tc.container
          .resolve(ListEnvironmentsRepository)
          .execute({ projectId });
        expect(stored.isOk() && stored.value.map((environment) => environment.env)).toEqual([
          "dev",
        ]);
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("shows an archived environment as skipped, never as new", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: V6 },
      stacks: [{ app: "core", stackName: "dev", resources: [stackResource({})] }],
    });

    try {
      await withContainer(async (tc) => {
        const created = await tc.container
          .resolve(CreateProjectUseCase)
          .execute({ name: "Preview Project", rootPath: fixture.rootPath, env: "dev" });
        if (created.isFail()) {
          throw new Error("Failed to create project");
        }
        const projectId = created.value.project.id;
        await tc.container
          .resolve(UpdateProjectRepository)
          .execute({ id: projectId, rootPath: fixture.rootPath });
        await tc.container
          .resolve(ArchiveEnvironmentRepository)
          .execute({ id: created.value.environment.id, archived: true });

        const result = await tc.container.resolve(SyncPreviewService).execute({ projectId });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
          return;
        }

        const dev = environmentNamed(result.value, "dev");
        expect(dev.change).toBe("skipped");
        expect(dev.note).toContain("Archived");
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("predicts the deployed flag and API URL the sync writes", async () => {
    const fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: V6 },
      stacks: [
        {
          app: "core",
          stackName: "dev",
          resources: [stackResource({ "webiny-api-url": "https://api.example.com" })],
        },
        {
          app: "api",
          stackName: "dev",
          resources: [stackResource({ apiUrl: "https://api.example.com" })],
        },
      ],
    });

    try {
      await withContainer(async (tc) => {
        const projectId = await registerProject(tc, fixture.rootPath);

        const previewed = await tc.container.resolve(SyncPreviewService).execute({ projectId });
        expect(previewed.isOk()).toBe(true);
        if (!previewed.isOk()) {
          return;
        }

        const predicted = environmentNamed(previewed.value, "dev").fields;

        await tc.container.resolve(SyncSystemService).execute({ projectId });

        const stored = await tc.container
          .resolve(ListEnvironmentsRepository)
          .execute({ projectId });
        if (!stored.isOk() || stored.value[0] === undefined) {
          throw new Error("No environment stored");
        }
        const environment = stored.value[0];

        // Whatever the preview said would change must be what the sync actually wrote.
        for (const field of predicted) {
          if (field.field === "deployed") {
            expect(environment.deployed ? "yes" : "no").toBe(field.incoming);
          }
          if (field.field === "apiUrl") {
            expect(environment.apiUrl).toBe(field.incoming);
          }
        }

        expect(predicted.map((field) => field.field)).toContain("apiUrl");
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("refuses a project with no checkout", async () => {
    await withContainer(async (tc) => {
      const created = await tc.container
        .resolve(CreateProjectUseCase)
        .execute({ name: "Remote only", apiUrl: "https://api.example.com", env: "dev" });
      if (created.isFail()) {
        throw new Error("Failed to create project");
      }

      const result = await tc.container
        .resolve(SyncPreviewService)
        .execute({ projectId: created.value.project.id });

      expect(result.isFail()).toBe(true);
    });
  });
});
