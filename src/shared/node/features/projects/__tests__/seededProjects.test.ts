import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "../create/abstractions/CreateProjectUseCase.js";
import { RemoveProjectUseCase } from "../remove/abstractions/RemoveProjectUseCase.js";
import { ListProjectsUseCase } from "../list/abstractions/ListProjectsUseCase.js";

describe("a project the seed file names", () => {
  let testContainer: ReturnType<typeof createTestContainer>;
  let directory: string;

  beforeEach(() => {
    testContainer = createTestContainer();
    // `.projects.json` is read from the working directory, so the tests run in their own.
    directory = mkdtempSync(join(tmpdir(), "seeded-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
    testContainer.cleanup();
  });

  function seedFile(names: string[]): void {
    writeFileSync(
      join(directory, ".projects.json"),
      JSON.stringify(
        names.map((name) => ({ name, apiUrl: "https://api.example.com", apiToken: "token" })),
      ),
    );
  }

  async function createProject(name: string): Promise<string> {
    const result = await testContainer.container.resolve(CreateProjectUseCase).execute({
      name,
      apiUrl: "https://api.example.com",
      apiToken: "token",
      tenant: "root",
    });
    if (result.isFail()) {
      throw new Error(result.error.message);
    }
    return result.value.project.id;
  }

  async function projects() {
    const listed = await testContainer.container.resolve(ListProjectsUseCase).execute();
    return listed.isOk() ? listed.value.projects : [];
  }

  it("refuses to delete it, and says how to make it deletable", async () => {
    const id = await createProject("Blog");
    seedFile(["Blog"]);

    const result = await testContainer.container.resolve(RemoveProjectUseCase).execute({ id });

    expect(result.isFail()).toBe(true);
    expect(result.isFail() && result.error.message).toContain(".projects.json");
    expect(await projects()).toHaveLength(1);
  });

  it("deletes one the seed file does not name", async () => {
    const id = await createProject("Blog");
    seedFile(["Something Else"]);

    expect(
      (await testContainer.container.resolve(RemoveProjectUseCase).execute({ id })).isOk(),
    ).toBe(true);
    expect(await projects()).toHaveLength(0);
  });

  it("deletes one when there is no seed file at all", async () => {
    const id = await createProject("Blog");

    expect(
      (await testContainer.container.resolve(RemoveProjectUseCase).execute({ id })).isOk(),
    ).toBe(true);
  });

  it("matches an entry whose name is a whole path, as older files carry", async () => {
    // `toProjectName` reduces a path to its last segment, and the seeder matches both forms.
    const id = await createProject("webiny-js-6.5");
    seedFile(["Users/brunozoric/work/webiny/webiny-js-6.5"]);

    const result = await testContainer.container.resolve(RemoveProjectUseCase).execute({ id });

    expect(result.isFail()).toBe(true);
  });

  it("marks it as seeded when it is listed, and not when it is not", async () => {
    await createProject("Blog");
    await createProject("Other");
    seedFile(["Blog"]);

    const byName = new Map((await projects()).map((project) => [project.name, project.seeded]));
    expect(byName.get("Blog")).toBe(true);
    expect(byName.get("Other")).toBe(false);
  });

  it("becomes deletable as soon as the entry is removed, with no restart", async () => {
    const id = await createProject("Blog");
    seedFile(["Blog"]);
    expect(
      (await testContainer.container.resolve(RemoveProjectUseCase).execute({ id })).isFail(),
    ).toBe(true);

    seedFile([]);

    expect(
      (await testContainer.container.resolve(RemoveProjectUseCase).execute({ id })).isOk(),
    ).toBe(true);
  });

  it("ignores a seed file that is not valid JSON", async () => {
    const id = await createProject("Blog");
    writeFileSync(join(directory, ".projects.json"), "{ not json");

    // Unreadable is not the same as "names every project"; it must not block deletion.
    expect(
      (await testContainer.container.resolve(RemoveProjectUseCase).execute({ id })).isOk(),
    ).toBe(true);
  });
});
