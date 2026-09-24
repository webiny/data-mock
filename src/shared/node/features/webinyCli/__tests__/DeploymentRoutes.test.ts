import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ApiFeature } from "~/api/feature.js";
import { createServer } from "~/api/server.js";
import { registerApiRoutes } from "~/api/routes/index.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { createFixtureProject, stackResource } from "./fixtures.js";

const PROJECT_NAME = "Deployment Routes";

describe("deploy and destroy routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;
  let fixture: ReturnType<typeof createFixtureProject>;
  let projectId: string;
  let environmentId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);

    fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: { "@webiny/cli": "6.4.9" } },
      stacks: [{ app: "core", stackName: "dev", resources: [stackResource({})] }],
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: PROJECT_NAME, rootPath: fixture.rootPath },
    });
    projectId = created.json().project.id;

    const environments = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/environments`,
    });
    environmentId = environments.json().environments.items[0].id;
  });

  afterEach(async () => {
    await app.close();
    fixture.cleanup();
    tc.cleanup();
  });

  /** Nothing here runs the queue, so no `webiny` process is ever spawned. */
  async function pendingJobs(): Promise<Array<{ type: string; config: string | null }>> {
    const { jobs } = await tc.container.resolve(JobWorker).listJobs({ projectId });
    return jobs.map((job) => ({ type: job.type, config: job.config }));
  }

  function deploy(payload: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/environments/${environmentId}/deploy`,
      payload,
    });
  }

  function destroy(payload: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/environments/${environmentId}/destroy`,
      payload,
    });
  }

  it("enqueues a deploy with the apps, region and preview flag it was given", async () => {
    const response = await deploy({ apps: ["api"], region: "us-east-1", preview: true });

    expect(response.statusCode).toBe(202);
    expect(response.json().job.type).toBe("deploy");

    const [job] = await pendingJobs();
    expect(JSON.parse(job?.config ?? "{}")).toEqual({
      environmentId,
      apps: ["api"],
      region: "us-east-1",
      preview: true,
    });
  });

  it("refuses a destroy that does not type the project name back", async () => {
    const response = await destroy({ confirmProjectName: "deployment routes" });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    // The check lives on the server because anything that can reach this endpoint can skip the
    // dialog that asks for it.
    expect(await pendingJobs()).toEqual([]);
  });

  it("refuses a destroy with no confirmation at all", async () => {
    const response = await destroy({ apps: ["core"] });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(await pendingJobs()).toEqual([]);
  });

  it("enqueues a destroy once the name matches exactly", async () => {
    const response = await destroy({ apps: ["core"], confirmProjectName: PROJECT_NAME });

    expect(response.statusCode).toBe(202);

    const [job] = await pendingJobs();
    expect(job?.type).toBe("destroy");
    // The app list is carried through: omitting it makes v6 tear down admin, api and core.
    expect(JSON.parse(job?.config ?? "{}").apps).toEqual(["core"]);
  });

  it("does not accept a destroy through the generic enqueue route", async () => {
    // That route's body is a bare config record, so it would route around the name check.
    const response = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/jobs`,
      payload: { type: "destroy", config: { environmentId } },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(await pendingJobs()).toEqual([]);
  });

  it("does not accept a deploy through the generic enqueue route", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/jobs`,
      payload: { type: "deploy", config: { environmentId } },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(await pendingJobs()).toEqual([]);
  });

  it("reports the apps this project's version can deploy", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/deployable-apps`,
    });

    expect(response.statusCode).toBe(200);
    const deployable = response.json().deployable;
    expect(deployable.versionMajor).toBe(6);
    // Not the apps that have Pulumi state — a fresh checkout has none.
    expect(deployable.apps).toContain("core");
  });

  it("404s a deploy for a project that does not exist", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/projects/nope/environments/${environmentId}/deploy`,
      payload: {},
    });

    // `jobs` has a foreign key to both ids, so an unresolved one used to surface as a 500.
    expect(response.statusCode).toBe(404);
  });

  it("404s a deploy for an environment that does not exist", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/environments/nope/deploy`,
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    expect(await pendingJobs()).toEqual([]);
  });

  it("refuses to deploy an environment that belongs to another project", async () => {
    const other = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Another", apiUrl: "https://api.example.com", apiToken: "t" },
    });
    const otherId = other.json().project.id;

    const response = await app.inject({
      method: "POST",
      url: `/api/projects/${otherId}/environments/${environmentId}/deploy`,
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    expect(await pendingJobs()).toEqual([]);
  });

  it("refuses to destroy an environment that belongs to another project", async () => {
    const other = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: PROJECT_NAME + " Two", apiUrl: "https://api.example.com", apiToken: "t" },
    });
    const otherId = other.json().project.id;

    const response = await app.inject({
      method: "POST",
      url: `/api/projects/${otherId}/environments/${environmentId}/destroy`,
      payload: { confirmProjectName: PROJECT_NAME + " Two" },
    });

    // The typed name matched the project in the path, which is not the one that owns the stack.
    expect(response.statusCode).toBe(404);
    expect(await pendingJobs()).toEqual([]);
  });
});
