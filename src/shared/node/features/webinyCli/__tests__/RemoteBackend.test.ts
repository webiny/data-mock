import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Result } from "@webiny/stdlib";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UpdateProjectRepository } from "~/shared/node/features/projects/update/abstractions/UpdateProjectRepository.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { CreateEnvironmentRepository } from "~/shared/node/features/environments/create/abstractions/CreateEnvironmentRepository.js";
import { ListEnvironmentsRepository } from "~/shared/node/features/environments/list/abstractions/ListEnvironmentsRepository.js";
import { ListStacksRepository } from "~/shared/node/features/environments/stacks/abstractions/ListStacksRepository.js";
import { ArchiveEnvironmentRepository } from "~/shared/node/features/environments/archive/abstractions/ArchiveEnvironmentRepository.js";
import { WebinyCliRunner } from "../runner/abstractions/WebinyCliRunner.js";
import { RemoteStackOutputReader } from "../remote/abstractions/RemoteStackOutputReader.js";
import { SyncSystemService } from "../sync/abstractions/SyncSystemService.js";
import { createFixtureProject } from "./fixtures.js";
import { WebinyCliError } from "~/shared/errors.js";

/** Answers `webiny output` with canned stdout, keyed by app. Never spawns. */
class StubRunner {
  public readonly calls: string[][] = [];
  public stdoutByApp: Record<string, string> = {};
  public failApps = new Set<string>();

  public readonly runner: WebinyCliRunner.Interface = {
    execute: async (input) => {
      this.calls.push(input.args);
      const app = input.args[1] ?? "";

      if (this.failApps.has(app)) {
        return Result.fail(new WebinyCliError("pulumi: no credentials", 1, ""));
      }

      return Result.ok({ stdout: this.stdoutByApp[app] ?? "null\n", stderr: "", exitCode: 0 });
    },
  };
}

describe("Remote backend", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let runner: StubRunner;

  beforeEach(() => {
    tc = createTestContainer();
    runner = new StubRunner();
    tc.container.registerInstance(WebinyCliRunner, runner.runner);
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("RemoteStackOutputReader", () => {
    function read(app = "api") {
      return tc.container.resolve(RemoteStackOutputReader).execute({
        rootPath: "/tmp/anywhere",
        versionMajor: 6,
        app,
        env: "dev",
        variant: "",
      });
    }

    it("always asks for JSON, with the app and env spelled out", async () => {
      await read();

      // Without --json the null path prints prose; v6's --env defaults to "dev" and its app
      // positional is required, so both are always passed explicitly.
      expect(runner.calls[0]).toEqual(["output", "api", "--env=dev", "--json"]);
    });

    it("reads a deployed stack from a non-empty output object", async () => {
      runner.stdoutByApp["api"] = '{"apiUrl":"https://example.com"}';

      const result = await read();

      expect(result.readState).toBe("deployed");
      expect(result.deployed).toBe(true);
      expect(result.outputs).toEqual({ apiUrl: "https://example.com" });
    });

    it("treats an empty object as not-deployed", async () => {
      // {} is the remote equivalent of a checkpoint with no `resources` key.
      runner.stdoutByApp["api"] = "{}";

      const result = await read();

      expect(result.readState).toBe("not-deployed");
      expect(result.deployed).toBe(false);
    });

    it("treats a literal null as unknown, never as not-deployed", async () => {
      runner.stdoutByApp["api"] = "null";

      const result = await read();

      expect(result.readState).toBe("unknown");
      expect(result.error).not.toBeNull();
    });

    it("treats prose output as unknown", async () => {
      runner.stdoutByApp["api"] = "No output values found.\n";

      const result = await read();

      expect(result.readState).toBe("unknown");
    });

    it("treats a failed command as unknown, carrying the reason", async () => {
      runner.failApps.add("api");

      const result = await read();

      expect(result.readState).toBe("unknown");
      expect(result.error).toContain("no credentials");
    });

    it("never reports a resource count, because the CLI cannot give one", async () => {
      runner.stdoutByApp["api"] = '{"apiUrl":"https://example.com"}';

      expect((await read()).resourceCount).toBeNull();
    });

    it("flags a v6 answer as possibly stale, and a v5 answer as not", async () => {
      runner.stdoutByApp["api"] = '{"apiUrl":"https://example.com"}';

      const v6 = await read();
      expect(v6.possiblyStale).toBe(true);

      const v5 = await tc.container.resolve(RemoteStackOutputReader).execute({
        rootPath: "/tmp/anywhere",
        versionMajor: 5,
        app: "api",
        env: "dev",
        variant: "",
      });
      expect(v5.possiblyStale).toBe(false);
    });
  });

  describe("SyncSystemService with a remote backend", () => {
    let fixture: ReturnType<typeof createFixtureProject>;
    let projectId: string;

    beforeEach(async () => {
      fixture = createFixtureProject({
        marker: "webiny.config.tsx",
        packageJson: { dependencies: { "@webiny/cli": "6.4.9" } },
        env: { WEBINY_PULUMI_BACKEND: "s3://my-state-bucket" },
      });

      const created = await tc.container.resolve(CreateProjectUseCase).execute({
        name: "Remote Backend",
        rootPath: fixture.rootPath,
        env: "dev",
      });
      if (created.isFail()) {
        throw new Error("Failed to create project");
      }
      projectId = created.value.project.id;

      await tc.container
        .resolve(UpdateProjectRepository)
        .execute({ id: projectId, rootPath: fixture.rootPath });
    });

    afterEach(() => {
      fixture.cleanup();
    });

    it("reads manually added environments through the CLI", async () => {
      runner.stdoutByApp["core"] = '{"region":"eu-central-1"}';
      runner.stdoutByApp["api"] = '{"apiUrl":"https://api.example.com","region":"eu-central-1"}';
      runner.stdoutByApp["admin"] = '{"appUrl":"https://admin.example.com"}';

      const result = await tc.container.resolve(SyncSystemService).execute({ projectId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.environmentsFound).toBe(1);
        expect(result.value.environmentsDeployed).toBe(1);
      }

      const environments = await tc.container
        .resolve(ListEnvironmentsRepository)
        .execute({ projectId });
      const environment = environments.isOk() ? environments.value[0] : undefined;

      expect(environment?.apiUrl).toBe("https://api.example.com");
      expect(environment?.adminUrl).toBe("https://admin.example.com");
      expect(environment?.region).toBe("eu-central-1");
    });

    it("stamps the project stale-possible rather than success on v6", async () => {
      runner.stdoutByApp["core"] = '{"region":"eu-central-1"}';
      runner.stdoutByApp["api"] = '{"apiUrl":"https://api.example.com"}';
      runner.stdoutByApp["admin"] = '{"appUrl":"https://admin.example.com"}';

      const result = await tc.container.resolve(SyncSystemService).execute({ projectId });

      expect(result.isOk() && result.value.status).toBe("stale-possible");

      const project = await tc.container.resolve(GetProjectRepository).execute({ id: projectId });
      expect(project.isOk() && project.value.lastSyncStatus).toBe("stale-possible");
    });

    it("stores no resource counts", async () => {
      runner.stdoutByApp["core"] = '{"region":"eu-central-1"}';

      await tc.container.resolve(SyncSystemService).execute({ projectId });

      const environments = await tc.container
        .resolve(ListEnvironmentsRepository)
        .execute({ projectId });
      const environmentId = environments.isOk() ? (environments.value[0]?.id ?? "") : "";

      const stacks = await tc.container.resolve(ListStacksRepository).execute({ environmentId });
      const core = stacks.isOk() ? stacks.value.find((stack) => stack.app === "core") : undefined;

      expect(core?.deployed).toBe(true);
      expect(core?.resourceCount).toBeNull();
    });

    it("says so when there is nothing registered to read", async () => {
      // Discovery finds nothing on a remote backend, so with no active environment there is
      // literally nothing to sync — and that must be stated, not reported as a clean success.
      const environments = await tc.container
        .resolve(ListEnvironmentsRepository)
        .execute({ projectId });
      const environmentId = environments.isOk() ? (environments.value[0]?.id ?? "") : "";

      await tc.container
        .resolve(ArchiveEnvironmentRepository)
        .execute({ id: environmentId, archived: true });

      const result = await tc.container.resolve(SyncSystemService).execute({ projectId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.environmentsFound).toBe(0);
        expect(result.value.status).toBe("partial");
        expect(result.value.messages.some((m) => m.includes("Add one manually"))).toBe(true);
      }
      expect(runner.calls).toHaveLength(0);
    });

    it("keeps reading the remaining apps when one command fails", async () => {
      runner.failApps.add("core");
      runner.stdoutByApp["api"] = '{"apiUrl":"https://api.example.com"}';
      runner.stdoutByApp["admin"] = '{"appUrl":"https://admin.example.com"}';

      const result = await tc.container.resolve(SyncSystemService).execute({ projectId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stacksUnknown).toBe(1);
        expect(result.value.messages.some((message) => message.includes("no credentials"))).toBe(
          true,
        );
      }
    });

    it("adds a second environment only when it is registered manually", async () => {
      await tc.container
        .resolve(CreateEnvironmentRepository)
        .execute({ projectId, env: "prod", variant: "" });

      runner.stdoutByApp["api"] = '{"apiUrl":"https://api.example.com"}';

      const result = await tc.container.resolve(SyncSystemService).execute({ projectId });

      // Discovery finds nothing on a remote backend — these two exist because they were added.
      expect(result.isOk() && result.value.environmentsFound).toBe(2);
    });
  });
});
