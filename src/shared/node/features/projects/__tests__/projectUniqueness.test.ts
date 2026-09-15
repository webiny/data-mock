import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectRepository } from "~/shared/node/features/projects/create/abstractions/CreateProjectRepository.js";
import { UpdateProjectRepository } from "~/shared/node/features/projects/update/abstractions/UpdateProjectRepository.js";
import { ArchiveProjectRepository } from "~/shared/node/features/projects/archive/abstractions/ArchiveProjectRepository.js";

describe("project uniqueness", () => {
  let tc: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    tc = createTestContainer();
  });

  afterEach(() => {
    tc.cleanup();
  });

  function create(name: string, rootPath?: string) {
    return tc.container
      .resolve(CreateProjectRepository)
      .execute(rootPath === undefined ? { name } : { name, rootPath });
  }

  it("refuses a second project with the same name", async () => {
    await create("webiny-js-6.5");

    const second = await create("webiny-js-6.5");

    // Every list, badge and destroy confirmation reads by name; two of them is ambiguous.
    expect(second.isFail()).toBe(true);
    expect(second.isFail() && second.error.message).toContain("already exists");
  });

  it("refuses a second project pointing at the same checkout", async () => {
    await create("one", "/work/webiny");

    const second = await create("two", "/work/webiny");

    // Two inventories of the same stacks, each overwriting the other on sync.
    expect(second.isFail()).toBe(true);
    expect(second.isFail() && second.error.message).toContain("already uses the checkout");
  });

  it("sees through a path spelled differently", async () => {
    await create("one", "/work/webiny");

    const second = await create("two", "/work/webiny/");

    expect(second.isFail()).toBe(true);
  });

  it("counts an archived project, which restoring would bring back", async () => {
    const first = await create("one", "/work/webiny");
    if (first.isFail()) {
      throw new Error("Failed to create project");
    }
    await tc.container
      .resolve(ArchiveProjectRepository)
      .execute({ id: first.value.id, archived: true });

    const second = await create("one");

    expect(second.isFail()).toBe(true);
  });

  it("lets a project keep its own name and checkout when updated", async () => {
    const created = await create("one", "/work/webiny");
    if (created.isFail()) {
      throw new Error("Failed to create project");
    }

    const updated = await tc.container
      .resolve(UpdateProjectRepository)
      .execute({ id: created.value.id, name: "one", rootPath: "/work/webiny" });

    // Colliding with itself is not a collision.
    expect(updated.isOk()).toBe(true);
  });

  it("refuses to move a project onto another's checkout", async () => {
    await create("one", "/work/one");
    const second = await create("two", "/work/two");
    if (second.isFail()) {
      throw new Error("Failed to create project");
    }

    const updated = await tc.container
      .resolve(UpdateProjectRepository)
      .execute({ id: second.value.id, rootPath: "/work/one" });

    expect(updated.isFail()).toBe(true);
  });

  it("allows any number of projects with no checkout", async () => {
    await create("one");
    const second = await create("two");

    expect(second.isOk()).toBe(true);
  });
});
