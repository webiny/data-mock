import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Result } from "@webiny/stdlib";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { WebinyCliError } from "~/shared/errors.js";
import { WebinyDeploymentService } from "~/shared/node/features/webinyCli/deployment/abstractions/WebinyDeploymentService.js";
import { DeployJobExecutor } from "../executors/abstractions/DeployJobExecutor.js";
import { DestroyJobExecutor } from "../executors/abstractions/DestroyJobExecutor.js";
import { parseDeploymentJobConfig } from "../executors/deploymentJobConfig.js";
import { createExecutionContext } from "./executionContext.js";

/**
 * Records what each executor asked for instead of spawning. Nothing in this file runs a real
 * deploy: one would cost money and take tens of minutes.
 */
function recordingDeployments() {
  const calls: WebinyDeploymentService.Input[] = [];
  let failure: WebinyCliError | null = null;
  let apps = ["core", "api"];

  const service: WebinyDeploymentService.Interface = {
    execute: async (input) => {
      calls.push(input);
      if (failure !== null) {
        return Result.fail(failure);
      }
      return Result.ok({ apps, preview: input.preview === true, refreshed: true });
    },
  };

  return {
    calls,
    service,
    failWith(error: WebinyCliError) {
      failure = error;
    },
    completes(completed: string[]) {
      apps = completed;
    },
  };
}

describe("Deployment job executors", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let deployments: ReturnType<typeof recordingDeployments>;

  beforeEach(() => {
    tc = createTestContainer();
    deployments = recordingDeployments();
    tc.container.registerInstance(WebinyDeploymentService, deployments.service);
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("parseDeploymentJobConfig", () => {
    it("refuses a job with no config, rather than deploying a guessed environment", () => {
      expect(() => parseDeploymentJobConfig(null)).toThrow(
        "Deployment jobs require a config naming the environment",
      );
    });

    it("refuses a config that names no environment", () => {
      expect(() => parseDeploymentJobConfig(JSON.stringify({ apps: ["api"] }))).toThrow();
    });

    it("refuses an empty environment id", () => {
      expect(() => parseDeploymentJobConfig(JSON.stringify({ environmentId: "" }))).toThrow();
    });

    it("keeps apps, region and preview when they are given", () => {
      const config = parseDeploymentJobConfig(
        JSON.stringify({
          environmentId: "env-1",
          apps: ["api"],
          region: "eu-central-1",
          preview: true,
        }),
      );

      expect(config).toEqual({
        environmentId: "env-1",
        apps: ["api"],
        region: "eu-central-1",
        preview: true,
      });
    });
  });

  describe("DeployJobExecutor", () => {
    function executor(): DeployJobExecutor.Interface {
      return tc.container.resolve(DeployJobExecutor);
    }

    it("refuses a job with no project", async () => {
      await expect(
        executor().execute(
          createExecutionContext({ projectId: null, config: { environmentId: "env-1" } }),
        ),
      ).rejects.toThrow("Deploy job requires a projectId");
    });

    it("refuses a job with no config", async () => {
      await expect(executor().execute(createExecutionContext())).rejects.toThrow(
        "Deployment jobs require a config naming the environment",
      );
    });

    it("deploys the environment the config names, not the one on the job", async () => {
      const context = createExecutionContext({
        projectId: "project-1",
        environmentId: "env-on-job",
        config: { environmentId: "env-in-config", apps: ["api"], region: "eu-central-1" },
      });

      await executor().execute(context);

      expect(deployments.calls[0]).toMatchObject({
        command: "deploy",
        projectId: "project-1",
        environmentId: "env-in-config",
        apps: ["api"],
        region: "eu-central-1",
        jobId: "job-1",
      });
    });

    it("forwards the job's abort signal, so cancelling kills the child", async () => {
      const context = createExecutionContext({ config: { environmentId: "env-1" } });

      await executor().execute(context);

      expect(deployments.calls[0]!.signal).toBe(context.signal);
    });

    it("streams the CLI output onto the job", async () => {
      const context = createExecutionContext({ config: { environmentId: "env-1" } });

      tc.container.registerInstance(WebinyDeploymentService, {
        execute: async (input) => {
          input.onLine?.("Deploying core...");
          input.onLine?.("Done.");
          return Result.ok({ apps: ["core"], preview: false, refreshed: true });
        },
      });

      await tc.container.resolve(DeployJobExecutor).execute(context);

      expect(context.logs).toEqual(["Deploying core...", "Done.", "Deployed: core."]);
    });

    it("reports a preview as having changed nothing", async () => {
      const context = createExecutionContext({
        config: { environmentId: "env-1", preview: true },
      });

      await executor().execute(context);

      expect(deployments.calls[0]!.preview).toBe(true);
      expect(context.logs).toEqual(["Previewed (nothing was changed): core, api."]);
    });

    it("says nothing was deployed when no app completed", async () => {
      deployments.completes([]);
      const context = createExecutionContext({ config: { environmentId: "env-1" } });

      await executor().execute(context);

      expect(context.logs).toEqual(["Deployed: nothing."]);
    });

    it("reports no percent, because pulumi emits none", async () => {
      const context = createExecutionContext({ config: { environmentId: "env-1" } });

      await executor().execute(context);

      expect(context.progress).toEqual([]);
    });

    it("fails the job when the deployment fails", async () => {
      deployments.failWith(new WebinyCliError("pulumi blew up", 1, "tail"));

      await expect(
        executor().execute(createExecutionContext({ config: { environmentId: "env-1" } })),
      ).rejects.toThrow("pulumi blew up");
    });
  });

  describe("DestroyJobExecutor", () => {
    function executor(): DestroyJobExecutor.Interface {
      return tc.container.resolve(DestroyJobExecutor);
    }

    it("refuses a job with no project", async () => {
      await expect(
        executor().execute(
          createExecutionContext({ projectId: null, config: { environmentId: "env-1" } }),
        ),
      ).rejects.toThrow("Destroy job requires a projectId");
    });

    it("refuses a job with no config", async () => {
      await expect(executor().execute(createExecutionContext())).rejects.toThrow(
        "Deployment jobs require a config naming the environment",
      );
    });

    it("destroys the environment the config names, and never previews", async () => {
      const context = createExecutionContext({
        projectId: "project-1",
        config: { environmentId: "env-in-config", apps: ["admin"], preview: true },
      });

      await executor().execute(context);

      expect(deployments.calls[0]).toMatchObject({
        command: "destroy",
        projectId: "project-1",
        environmentId: "env-in-config",
        apps: ["admin"],
        jobId: "job-1",
      });
      // A destroy has no dry run — a `preview` left on the config must not reach the service.
      expect(deployments.calls[0]!.preview).toBeUndefined();
      expect(context.logs).toEqual(["Destroyed: core, api."]);
    });

    it("says nothing was destroyed when no app completed", async () => {
      deployments.completes([]);
      const context = createExecutionContext({ config: { environmentId: "env-1" } });

      await executor().execute(context);

      expect(context.logs).toEqual(["Destroyed: nothing."]);
    });

    it("fails the job when the destroy fails", async () => {
      deployments.failWith(new WebinyCliError("stack is locked", 1, "tail"));

      await expect(
        executor().execute(createExecutionContext({ config: { environmentId: "env-1" } })),
      ).rejects.toThrow("stack is locked");
    });
  });
});
