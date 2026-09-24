import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createCliTestContainer, resolveCommand } from "~/cli/testing/createCliTestContainer.js";
import type { ICliTestContainer } from "~/cli/testing/createCliTestContainer.js";
import { CANCELLED, pick } from "~/cli/testing/StubPrompts.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import { projects, seedEntries } from "~/shared/node/db/schema.js";
import { ListProjectsUseCase } from "~/shared/node/features/projects/list/abstractions/ListProjectsUseCase.js";
import type { Project } from "~/shared/types.js";

describe("add-project command", () => {
  let tc: ICliTestContainer;

  afterEach(() => {
    tc.cleanup();
  });

  function answers(values: unknown[]): void {
    tc = createCliTestContainer({ answers: values });
  }

  it("creates the project and its first environment from the answers", async () => {
    answers(["Blog", "https://api.example.com", "secret-token", "root", "6.4.9"]);

    await resolveCommand(tc, "add-project").execute();

    const list = await tc.container.resolve(ListProjectsUseCase).execute();
    const created = list.isOk() ? list.value.projects : [];
    expect(created.map((project: Project) => project.name)).toEqual(["Blog"]);
    expect(tc.ui.said('Project "Blog" added with environment "dev"')).toBe(true);
  });

  it("stores the token encrypted, never as it was typed", async () => {
    answers(["Blog", "https://api.example.com", "secret-token", "root", "6.4.9"]);

    await resolveCommand(tc, "add-project").execute();

    const rows = tc.databaseClient.db.select().from(projects).all();
    expect(JSON.stringify(rows)).not.toContain("secret-token");
  });

  it("stops at the first cancelled prompt, writing nothing", async () => {
    answers(["Blog", CANCELLED]);

    await resolveCommand(tc, "add-project").execute();

    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
    expect(tc.databaseClient.db.select().from(projects).all()).toHaveLength(0);
  });

  it("requires a name and a well-formed URL", async () => {
    answers(["Blog", "https://api.example.com", "token", "root", "6.4.9"]);

    await resolveCommand(tc, "add-project").execute();

    const nameCheck = tc.prompts.validators.get("Project name")!;
    expect(nameCheck("")).toBe("Name is required");
    expect(nameCheck("Blog")).toBeUndefined();

    const urlCheck = tc.prompts.validators.get("Webiny GraphQL API URL")!;
    expect(urlCheck("")).toBe("URL is required");
    expect(urlCheck("api.example.com")).toBe("URL must start with http:// or https://");
    expect(urlCheck("https://api.example.com")).toBeUndefined();
  });

  it("falls back to the root tenant and a default version when both are left blank", async () => {
    answers(["Blog", "https://api.example.com", "token", "", ""]);

    await resolveCommand(tc, "add-project").execute();

    const row = tc.databaseClient.db.select().from(projects).all()[0]!;
    expect(row.operationsVersion).toBe("6.0.0");
  });

  it("reports a refused save rather than announcing a project that does not exist", async () => {
    const script = ["Blog", "https://api.example.com", "token", "root", "6.4.9"];
    answers([...script, ...script]);

    await resolveCommand(tc, "add-project").execute();
    await resolveCommand(tc, "add-project").execute();

    // Project names are unique; the second add must fail loudly rather than print a success.
    expect(tc.ui.on("error").join("\n")).toContain("Failed to save project");
    expect(tc.databaseClient.db.select().from(projects).all()).toHaveLength(1);
  });
});

describe("list-projects command", () => {
  let tc: ICliTestContainer;

  afterEach(() => {
    tc.cleanup();
  });

  it("says how to add the first project when there are none", async () => {
    tc = createCliTestContainer();

    await resolveCommand(tc, "list-projects").execute();

    expect(tc.ui.on("info")).toEqual([
      "No projects configured. Run 'yarn cli add-project' to add one.",
    ]);
  });

  it("shows the checkout and version of each project", async () => {
    tc = createCliTestContainer();
    await createTestProject(tc, { name: "Blog" });

    await resolveCommand(tc, "list-projects").execute();

    const note = tc.ui.on("note").join("\n");
    expect(note).toContain("1 project(s)");
    expect(note).toContain("Blog");
    // Created with neither a checkout on disk nor a detected version.
    expect(note).toContain("remote only");
    expect(note).toContain("workspace root");
  });
});

describe("remove-project command", () => {
  let tc: ICliTestContainer;
  let projectId: string;

  /** A project with one seed entry, so a delete has something to count and to destroy. */
  async function projectWithData(answers: unknown[]): Promise<void> {
    tc = createCliTestContainer({ answers });
    const project = await createTestProject(tc, { name: "Blog" });
    projectId = project.projectId;

    tc.databaseClient.db
      .insert(seedEntries)
      .values({
        id: "entry-1",
        projectId: project.projectId,
        environmentId: project.environmentId,
        tenant: "root",
        modelId: "article",
        entryId: "remote-1",
        entryData: "{}",
        status: "created",
        createdAt: Date.now(),
      })
      .run();
  }

  afterEach(() => {
    tc.cleanup();
  });

  function storedProject(): typeof projects.$inferSelect | undefined {
    return tc.databaseClient.db.select().from(projects).where(eq(projects.id, projectId)).get();
  }

  function storedEntries(): number {
    return tc.databaseClient.db.select().from(seedEntries).all().length;
  }

  it("says there is nothing to remove when no project is configured", async () => {
    tc = createCliTestContainer();

    await resolveCommand(tc, "remove-project").execute();

    expect(tc.ui.on("info")).toEqual(["No projects configured."]);
  });

  it("counts what a permanent delete would destroy, before offering one", async () => {
    await projectWithData([pick("Blog"), "archive"]);

    await resolveCommand(tc, "remove-project").execute();

    const counted = tc.ui.on("info").join("\n");
    expect(counted).toContain("A permanent delete would destroy:");
    expect(counted).toContain("1 seed entries");
  });

  it("archives by default, destroying nothing", async () => {
    await projectWithData([pick("Blog"), "archive"]);

    await resolveCommand(tc, "remove-project").execute();

    expect(storedProject()!.archivedAt).not.toBeNull();
    expect(storedEntries()).toBe(1);
    expect(tc.ui.said('Project "Blog" archived')).toBe(true);
  });

  it("offers Restore, not Archive, for a project that is already archived", async () => {
    await projectWithData([pick("Blog"), "archive", pick("Blog"), "restore"]);

    const command = resolveCommand(tc, "remove-project");
    await command.execute();
    await command.execute();

    expect(storedProject()!.archivedAt).toBeNull();
    // The second run must not have offered to archive what is already archived.
    const actionPrompts = tc.prompts.calls.filter((call) =>
      call.message.startsWith("What should happen"),
    );
    expect(actionPrompts[1]!.labels).toEqual(["Restore", "Delete permanently"]);
  });

  it("purges only after the delete is confirmed", async () => {
    await projectWithData([pick("Blog"), "purge", true]);

    await resolveCommand(tc, "remove-project").execute();

    expect(storedProject()).toBeUndefined();
    // Every child table cascades: the entry goes with the project.
    expect(storedEntries()).toBe(0);
    expect(tc.ui.said('Project "Blog" and all of its data were deleted.')).toBe(true);
  });

  it("keeps everything when the delete is declined", async () => {
    await projectWithData([pick("Blog"), "purge", false]);

    await resolveCommand(tc, "remove-project").execute();

    expect(storedProject()).toBeDefined();
    expect(storedEntries()).toBe(1);
    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
  });

  it("keeps everything when the delete confirmation is cancelled", async () => {
    await projectWithData([pick("Blog"), "purge", CANCELLED]);

    await resolveCommand(tc, "remove-project").execute();

    expect(storedProject()).toBeDefined();
    expect(storedEntries()).toBe(1);
  });

  it("does nothing when the project choice is cancelled", async () => {
    await projectWithData([CANCELLED]);

    await resolveCommand(tc, "remove-project").execute();

    expect(storedProject()!.archivedAt).toBeNull();
    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
  });

  it("does nothing when the action choice is cancelled", async () => {
    await projectWithData([pick("Blog"), CANCELLED]);

    await resolveCommand(tc, "remove-project").execute();

    expect(storedProject()!.archivedAt).toBeNull();
    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
  });

  it("lists archived projects too, so one can be restored", async () => {
    await projectWithData([pick("Blog"), "archive", pick("Blog"), "restore"]);

    const command = resolveCommand(tc, "remove-project");
    await command.execute();
    await command.execute();

    const selects = tc.prompts.calls.filter((call) => call.message === "Select project");
    expect(selects[1]!.labels).toEqual(["Blog"]);
  });
});
