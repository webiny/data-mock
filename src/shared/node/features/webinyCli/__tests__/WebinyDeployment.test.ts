import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Result } from "@webiny/stdlib";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UpdateProjectRepository } from "~/shared/node/features/projects/update/abstractions/UpdateProjectRepository.js";
import { ListEnvironmentsRepository } from "~/shared/node/features/environments/list/abstractions/ListEnvironmentsRepository.js";
import { ListStacksRepository } from "~/shared/node/features/environments/stacks/abstractions/ListStacksRepository.js";
import { ArchiveEnvironmentRepository } from "~/shared/node/features/environments/archive/abstractions/ArchiveEnvironmentRepository.js";
import { WebinyCliRunner } from "../runner/abstractions/WebinyCliRunner.js";
import { WebinyDeploymentService } from "../deployment/abstractions/WebinyDeploymentService.js";
import { createFixtureProject, stackResource } from "./fixtures.js";
import { WebinyCliError } from "~/shared/errors.js";

/** Records every invocation instead of spawning. No test in this file runs a real deploy. */
class RecordingRunner {
  public readonly calls: Array<{ args: string[]; awsProfile: string | null | undefined }> = [];
  public failOn: string | null = null;
  /** Written into the checkout before each call, to simulate what the CLI leaves behind. */
  public onRun: ((args: string[]) => void) | null = null;

  public readonly runner: WebinyCliRunner.Interface = {
    execute: async (input) => {
      this.calls.push({ args: input.args, awsProfile: input.awsProfile });
      this.onRun?.(input.args);

      if (this.failOn !== null && input.args.includes(this.failOn)) {
        return Result.fail(new WebinyCliError("pulumi blew up", 1, "tail"));
      }

      return Result.ok({ stdout: "", stderr: "", exitCode: 0 });
    },
  };
}

describe("WebinyDeploymentService", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let fixture: ReturnType<typeof createFixtureProject>;
  let runner: RecordingRunner;
  let projectId: string;
  let environmentId: string;

  beforeEach(async () => {
    tc = createTestContainer();

    fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: { "@webiny/cli": "6.4.9" } },
      stacks: [
        { app: "core", stackName: "dev", resources: [stackResource({ region: "eu-central-1" })] },
        {
          app: "api",
          stackName: "dev",
          resources: [stackResource({ apiUrl: "https://api.example.com" })],
        },
        {
          app: "admin",
          stackName: "dev",
          resources: [stackResource({ appUrl: "https://admin.example.com" })],
        },
      ],
    });

    const created = await tc.container.resolve(CreateProjectUseCase).execute({
      name: "Deployable",
      rootPath: fixture.rootPath,
      env: "dev",
    });
    if (created.isFail()) {
      throw new Error("Failed to create project");
    }
    projectId = created.value.project.id;
    environmentId = created.value.environment.id;

    await tc.container
      .resolve(UpdateProjectRepository)
      .execute({ id: projectId, rootPath: fixture.rootPath, awsProfile: "my-profile" });

    runner = new RecordingRunner();
    tc.container.registerInstance(WebinyCliRunner, runner.runner);
  });

  afterEach(() => {
    fixture.cleanup();
    tc.cleanup();
  });

  function service(): WebinyDeploymentService.Interface {
    return tc.container.resolve(WebinyDeploymentService);
  }

  it("deploys every app in dependency order when none are named", async () => {
    const result = await service().execute({ command: "deploy", projectId, environmentId });

    expect(result.isOk()).toBe(true);
    expect(runner.calls.map((call) => call.args[1])).toEqual(["core", "api", "admin"]);
  });

  it("destroys in the reverse order", async () => {
    const result = await service().execute({ command: "destroy", projectId, environmentId });

    expect(result.isOk()).toBe(true);
    expect(runner.calls.map((call) => call.args[1])).toEqual(["admin", "api", "core"]);
  });

  it("runs one app per invocation, always with the app positional", async () => {
    await service().execute({ command: "destroy", projectId, environmentId, apps: ["admin"] });

    // Omitting the app makes v6 destroy admin, api and core with no confirmation at all.
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.args).toEqual(["destroy", "admin", "--env=dev"]);
  });

  it("passes the project's AWS profile to the child", async () => {
    await service().execute({ command: "deploy", projectId, environmentId, apps: ["core"] });

    expect(runner.calls[0]?.awsProfile).toBe("my-profile");
  });

  it("refuses an app the project's version does not know", async () => {
    const result = await service().execute({
      command: "deploy",
      projectId,
      environmentId,
      apps: ["website"],
    });

    expect(result.isFail()).toBe(true);
    expect(runner.calls).toHaveLength(0);
  });

  it("refuses to act on an archived environment", async () => {
    await tc.container
      .resolve(ArchiveEnvironmentRepository)
      .execute({ id: environmentId, archived: true });

    const result = await service().execute({ command: "deploy", projectId, environmentId });

    expect(result.isFail()).toBe(true);
    expect(runner.calls).toHaveLength(0);
  });

  it("refuses a project with no local checkout", async () => {
    const remote = await tc.container.resolve(CreateProjectUseCase).execute({
      name: "Remote",
      apiUrl: "https://api.example.com",
      apiToken: "token",
    });
    if (remote.isFail()) {
      throw new Error("Failed to create remote project");
    }

    const result = await service().execute({
      command: "deploy",
      projectId: remote.value.project.id,
      environmentId: remote.value.environment.id,
    });

    expect(result.isFail()).toBe(true);
  });

  it("refreshes stack state after a successful run", async () => {
    const result = await service().execute({ command: "deploy", projectId, environmentId });
    expect(result.isOk()).toBe(true);

    const stacks = await tc.container.resolve(ListStacksRepository).execute({ environmentId });
    expect(stacks.isOk() && stacks.value.map((stack) => stack.app).sort()).toEqual([
      "admin",
      "api",
      "core",
    ]);

    const environments = await tc.container
      .resolve(ListEnvironmentsRepository)
      .execute({ projectId });
    const environment = environments.isOk() ? environments.value[0] : undefined;

    expect(environment?.deployed).toBe(true);
    expect(environment?.apiUrl).toBe("https://api.example.com");
    expect(environment?.adminUrl).toBe("https://admin.example.com");
    expect(environment?.region).toBe("eu-central-1");
  });

  it("refreshes after a failure too, because a failed deploy is rarely a no-op", async () => {
    runner.failOn = "api";

    const result = await service().execute({ command: "deploy", projectId, environmentId });

    expect(result.isFail()).toBe(true);
    // core ran, api failed, admin never started.
    expect(runner.calls.map((call) => call.args[1])).toEqual(["core", "api"]);

    const stacks = await tc.container.resolve(ListStacksRepository).execute({ environmentId });
    expect(stacks.isOk() && stacks.value).toHaveLength(3);
  });

  it("keeps the admin URL when only the api app is deployed", async () => {
    // Deriving the environment row from just the app that ran would blank a URL it never touched.
    const result = await service().execute({
      command: "deploy",
      projectId,
      environmentId,
      apps: ["api"],
    });

    expect(result.isOk()).toBe(true);

    const environments = await tc.container
      .resolve(ListEnvironmentsRepository)
      .execute({ projectId });

    expect(environments.isOk() && environments.value[0]?.adminUrl).toBe(
      "https://admin.example.com",
    );
  });

  it("keeps the environment deployed when only one app is destroyed", async () => {
    // Simulates the CLI emptying the admin checkpoint. core and api are still up, so the
    // environment is still deployed.
    runner.onRun = (args) => {
      if (args[0] !== "destroy" || args[1] !== "admin") {
        return;
      }
      const file = path.join(fixture.rootPath, ".pulumi/apps/admin/.pulumi/stacks/admin/dev.json");
      fs.writeFileSync(
        file,
        JSON.stringify({ version: 3, checkpoint: { latest: { manifest: {} } } }),
      );
    };

    const result = await service().execute({
      command: "destroy",
      projectId,
      environmentId,
      apps: ["admin"],
    });

    expect(result.isOk()).toBe(true);

    const environments = await tc.container
      .resolve(ListEnvironmentsRepository)
      .execute({ projectId });
    const environment = environments.isOk() ? environments.value[0] : undefined;

    expect(environment?.deployed).toBe(true);
    expect(environment?.apiUrl).toBe("https://api.example.com");
    // The destroyed app's URL goes, and only that one.
    expect(environment?.adminUrl).toBeNull();
  });

  it("does not refresh stack state after a preview, which changed nothing", async () => {
    const result = await service().execute({
      command: "deploy",
      projectId,
      environmentId,
      apps: ["core"],
      preview: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.preview).toBe(true);
      expect(result.value.refreshed).toBe(false);
    }

    expect(runner.calls[0]?.args).toContain("--preview");

    const stacks = await tc.container.resolve(ListStacksRepository).execute({ environmentId });
    expect(stacks.isOk() && stacks.value).toHaveLength(0);
  });

  it("stops before the next app once the signal aborts", async () => {
    const controller = new AbortController();
    runner.onRun = () => controller.abort();

    const result = await service().execute({
      command: "deploy",
      projectId,
      environmentId,
      signal: controller.signal,
    });

    expect(result.isOk()).toBe(true);
    expect(runner.calls).toHaveLength(1);
  });
});
