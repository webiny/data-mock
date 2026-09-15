import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "../create/abstractions/CreateProjectUseCase.js";
import { toProjectName } from "~/shared/projects/projectName.js";

describe("toProjectName", () => {
  it("leaves an ordinary name alone", () => {
    expect(toProjectName("My Webiny Project")).toBe("My Webiny Project");
  });

  it("takes the last segment of a path", () => {
    // The shape actually stored by older entries in .projects.json.
    expect(toProjectName("Users/brunozoric/work/webiny/webiny-js-6.5")).toBe("webiny-js-6.5");
    expect(toProjectName("/Users/brunozoric/work/webiny/webiny-js")).toBe("webiny-js");
  });

  it("ignores a trailing separator", () => {
    expect(toProjectName("/Users/me/work/project/")).toBe("project");
  });

  it("handles Windows separators", () => {
    expect(toProjectName("C:\\\\Users\\\\me\\\\project")).toBe("project");
  });

  it("trims surrounding whitespace", () => {
    expect(toProjectName("  spaced  ")).toBe("spaced");
  });

  it("leaves a name that is only separators for validation to reject", () => {
    // Inventing a name here would turn an invalid input into a silently accepted one.
    expect(toProjectName("///")).toBe("///");
  });
});

describe("CreateProjectUseCase naming", () => {
  let tc: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    tc = createTestContainer();
  });

  afterEach(() => {
    tc.cleanup();
  });

  it("stores the folder name when a path is given as the name", async () => {
    const result = await tc.container.resolve(CreateProjectUseCase).execute({
      name: "/Users/brunozoric/work/webiny/webiny-js",
      apiUrl: "https://api.example.com",
      apiToken: "token",
    });

    expect(result.isOk() && result.value.project.name).toBe("webiny-js");
  });
});
