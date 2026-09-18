import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ProjectScanner } from "~/shared/node/features/filesystem/scan/abstractions/ProjectScanner.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UpdateProjectRepository } from "~/shared/node/features/projects/update/abstractions/UpdateProjectRepository.js";
import { createFixtureProject } from "~/shared/node/features/webinyCli/__tests__/fixtures.js";

describe("ProjectScanner dedupe", () => {
  /** Scans the fixture's parent and returns the candidate for the fixture itself. */
  async function scanFor(
    tc: ReturnType<typeof createTestContainer>,
    rootPath: string,
  ): Promise<{ registered: boolean; attachableProjectId: string | null } | undefined> {
    const result = await tc.container
      .resolve(ProjectScanner)
      .execute({ paths: [path.dirname(rootPath)], maxDepth: 1 });

    if (!result.isOk()) {
      return undefined;
    }

    return result.value.candidates.find((candidate) => candidate.rootPath === rootPath);
  }

  it("offers a checkout to the project of that name that has none", async () => {
    const fixture = createFixtureProject({ marker: "webiny.config.tsx" });
    const rootPath = fs.realpathSync(fixture.rootPath);
    const tc = createTestContainer();

    try {
      // A remote-only project of the same name, which is all `.projects.json` could ever create.
      await tc.container
        .resolve(CreateProjectUseCase)
        .execute({ name: path.basename(rootPath), apiUrl: "https://api.example.com", env: "dev" });

      const candidate = await scanFor(tc, rootPath);

      // Adding it would leave two rows for one system, only one of which can be deployed.
      expect(candidate?.registered).toBe(false);
      expect(candidate?.attachableProjectId).not.toBeNull();
    } finally {
      fixture.cleanup();
      tc.cleanup();
    }
  });

  it("calls a checkout registered once a project points at it", async () => {
    const fixture = createFixtureProject({ marker: "webiny.config.tsx" });
    const rootPath = fs.realpathSync(fixture.rootPath);
    const tc = createTestContainer();

    try {
      const created = await tc.container
        .resolve(CreateProjectUseCase)
        .execute({ name: path.basename(rootPath), apiUrl: "https://api.example.com", env: "dev" });
      if (created.isFail()) {
        throw new Error("Failed to create project");
      }

      await tc.container
        .resolve(UpdateProjectRepository)
        .execute({ id: created.value.project.id, rootPath });

      const candidate = await scanFor(tc, rootPath);

      expect(candidate?.registered).toBe(true);
      // Nothing to attach: it is already pointed at this checkout.
      expect(candidate?.attachableProjectId).toBeNull();
    } finally {
      fixture.cleanup();
      tc.cleanup();
    }
  });

  it("leaves an unrelated checkout alone", async () => {
    const fixture = createFixtureProject({ marker: "webiny.config.tsx" });
    const rootPath = fs.realpathSync(fixture.rootPath);
    const tc = createTestContainer();

    try {
      await tc.container
        .resolve(CreateProjectUseCase)
        .execute({ name: "something-else", apiUrl: "https://api.example.com", env: "dev" });

      const candidate = await scanFor(tc, rootPath);

      expect(candidate?.registered).toBe(false);
      expect(candidate?.attachableProjectId).toBeNull();
    } finally {
      fixture.cleanup();
      tc.cleanup();
    }
  });
});
