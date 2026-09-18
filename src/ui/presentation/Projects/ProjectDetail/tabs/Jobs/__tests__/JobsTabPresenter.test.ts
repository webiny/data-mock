import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { Job } from "~/shared/types.js";
import { listJobsRoute, getJobRoute, cancelJobRoute } from "~/shared/routes/jobs.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { JobsTabFeature } from "../feature.js";
import { JobsTabPresenter } from "../abstractions/JobsTabPresenter.js";

const PROJECT_ID = "p1";
const LIST_PATH = listJobsRoute.path;
const GET_PATH = getJobRoute.path;
const CANCEL_PATH = cancelJobRoute.path;

// Jobs is project-scoped: there is deliberately no environment on this context.
const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: null,
  envName: null,
  tenant: "root",
};

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    projectId: PROJECT_ID,
    environmentId: null,
    type: "seed",
    status: "completed",
    config: null,
    logs: null,
    result: null,
    progress: null,
    progressLabel: null,
    startedAt: 1,
    completedAt: 2,
    createdAt: 1,
    ...overrides,
  };
}

describe("JobsTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: JobsTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    JobsTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());
    http.data.set(LIST_PATH, [job("j1")]);
    presenter = JobsTabFeature.resolve(container).presenter;
  });

  it("reads the jobs list for the project even with no environment resolved", async () => {
    await presenter.activate(CONTEXT);

    expect(http.calls.filter((call) => call.path === LIST_PATH)).toHaveLength(1);
    expect(presenter.vm.jobs.map((j) => j.id)).toEqual(["j1"]);
  });

  it("shows what it read to an observer", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.jobs.length));

    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(1);
    stop();
  });

  it("reads once for the same context", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.calls.filter((call) => call.path === LIST_PATH)).toHaveLength(1);
  });

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(LIST_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.jobs).toEqual([]);

    http.failures.delete(LIST_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.jobs).toHaveLength(1);
  });

  it("loads a different page", async () => {
    await presenter.activate(CONTEXT);

    presenter.loadJobsPage(2);
    await Promise.resolve();
    await Promise.resolve();

    expect(presenter.vm.jobsPage).toBe(2);
    const calls = http.calls.filter((call) => call.path === LIST_PATH);
    expect(calls.at(-1)?.query).toMatchObject({ page: "2" });
  });

  it("filters by job type", async () => {
    await presenter.activate(CONTEXT);

    presenter.setJobsFilter("jobType", "seed");
    await Promise.resolve();
    await Promise.resolve();

    expect(presenter.vm.jobsTypeFilter).toBe("seed");
    const calls = http.calls.filter((call) => call.path === LIST_PATH);
    expect(calls.at(-1)?.query).toMatchObject({ type: "seed" });
  });

  it("filters by job status", async () => {
    await presenter.activate(CONTEXT);

    presenter.setJobsFilter("jobStatus", "running");
    await Promise.resolve();
    await Promise.resolve();

    expect(presenter.vm.jobsStatusFilter).toBe("running");
    const calls = http.calls.filter((call) => call.path === LIST_PATH);
    expect(calls.at(-1)?.query).toMatchObject({ status: "running" });
  });

  it("clears both filters at once", async () => {
    await presenter.activate(CONTEXT);
    presenter.setJobsFilter("jobType", "seed");
    presenter.setJobsFilter("jobStatus", "running");
    await Promise.resolve();

    presenter.clearJobsFilter();
    await Promise.resolve();
    await Promise.resolve();

    expect(presenter.vm.jobsTypeFilter).toBeNull();
    expect(presenter.vm.jobsStatusFilter).toBeNull();
  });

  it("opens a job and shows its detail", async () => {
    http.data.set(GET_PATH, job("j1", { logs: "line one" }));
    await presenter.activate(CONTEXT);

    await presenter.openJob("j1");

    expect(presenter.vm.selectedJob?.id).toBe("j1");
    expect(presenter.vm.isLoadingSelectedJob).toBe(false);
  });

  it("closes the open job", async () => {
    http.data.set(GET_PATH, job("j1"));
    await presenter.activate(CONTEXT);
    await presenter.openJob("j1");

    presenter.closeJob();

    expect(presenter.vm.selectedJob).toBeNull();
  });

  it("cancels a job even with no environment resolved", async () => {
    http.data.set(CANCEL_PATH, job("j1", { status: "cancelled" }));
    await presenter.activate(CONTEXT);

    await presenter.cancelJob("j1");

    expect(http.calls.filter((call) => call.path === CANCEL_PATH)).toHaveLength(1);
  });

  it("shows a live log line arriving for the open job", async () => {
    http.data.set(GET_PATH, job("j1", { status: "running" }));
    await presenter.activate(CONTEXT);
    await presenter.openJob("j1");

    container.resolve(EventBridge).emit("job:log", {
      jobId: "j1",
      projectId: PROJECT_ID,
      line: "hello from the job",
    });

    expect(presenter.liveLogsFor("j1")).toBe("hello from the job");
  });

  it("ignores a live log line from another project", async () => {
    http.data.set(GET_PATH, job("j1", { status: "running" }));
    await presenter.activate(CONTEXT);
    await presenter.openJob("j1");

    container.resolve(EventBridge).emit("job:log", {
      jobId: "j1",
      projectId: "other",
      line: "not for this project",
    });

    expect(presenter.liveLogsFor("j1")).toBe("");
  });

  it("reads again when a job that writes the jobs dataset finishes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(LIST_PATH, [job("j1"), job("j2")]);

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j2",
      projectId: PROJECT_ID,
      type: "seed",
      status: "completed",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(presenter.vm.jobs).toHaveLength(2);
  });

  it("ignores a job from another project", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.filter((call) => call.path === LIST_PATH).length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j2",
      projectId: "other",
      type: "seed",
      status: "completed",
    });
    await Promise.resolve();

    expect(http.calls.filter((call) => call.path === LIST_PATH)).toHaveLength(before);
  });

  it("ignores a job that has not reached a terminal status", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.filter((call) => call.path === LIST_PATH).length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j2",
      projectId: PROJECT_ID,
      type: "seed",
      status: "running",
    });
    await Promise.resolve();

    expect(http.calls.filter((call) => call.path === LIST_PATH)).toHaveLength(before);
  });

  it("stops listening once disposed", async () => {
    await presenter.activate(CONTEXT);
    presenter.dispose();
    const before = http.calls.filter((call) => call.path === LIST_PATH).length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j2",
      projectId: PROJECT_ID,
      type: "seed",
      status: "completed",
    });
    await Promise.resolve();

    expect(http.calls.filter((call) => call.path === LIST_PATH)).toHaveLength(before);
  });
});
