import { describe, it, expect } from "vitest";
import { ProjectDatasets } from "../ProjectDatasets.js";
import type { IDatasetContext, IDatasetDefinition } from "../ProjectDatasets.js";

const REF = { projectId: "p1", environmentId: "e1" };

function counting(scope: "project" | "environment"): {
  definition: IDatasetDefinition;
  reads: number;
} {
  const state = { reads: 0 };
  const read = async (): Promise<boolean> => {
    state.reads += 1;
    return true;
  };

  return {
    definition: scope === "project" ? { scope, read } : { scope, read },
    get reads() {
      return state.reads;
    },
  };
}

describe("ProjectDatasets", () => {
  function datasets(
    definitions: Record<string, IDatasetDefinition>,
    context: () => IDatasetContext | null,
  ): ProjectDatasets {
    return new ProjectDatasets(definitions, context);
  }

  it("reads a dataset once, however often the tab is activated", async () => {
    const stacks = counting("environment");
    const subject = datasets({ stacks: stacks.definition }, () => ({
      projectId: "p1",
      ref: REF,
    }));

    await subject.loadAll(["stacks"]);
    await subject.loadAll(["stacks"]);

    expect(stacks.reads).toBe(1);
  });

  it("leaves a dataset unread, and unloaded, while there is no environment", async () => {
    const stacks = counting("environment");
    let ref: typeof REF | null = null;
    const subject = datasets({ stacks: stacks.definition }, () => ({ projectId: "p1", ref }));

    await subject.loadAll(["stacks"]);
    expect(stacks.reads).toBe(0);

    /**
     * The page activates a view before the environment has resolved, so this skip is expected.
     * What matters is that it is not recorded as loaded: the activation that follows the
     * resolution has to actually fetch, or the tab stays empty until the page is re-entered.
     */
    expect(subject.isLoaded("stacks")).toBe(false);

    ref = REF;
    await subject.loadAll(["stacks"]);

    expect(stacks.reads).toBe(1);
    expect(subject.isLoaded("stacks")).toBe(true);
  });

  it("reads a project-scoped dataset even with no environment", async () => {
    const jobs = counting("project");
    const subject = datasets({ jobs: jobs.definition }, () => ({ projectId: "p1", ref: null }));

    await subject.loadAll(["jobs"]);

    expect(jobs.reads).toBe(1);
  });

  it("reads nothing at all before a project is known", async () => {
    const jobs = counting("project");
    const subject = datasets({ jobs: jobs.definition }, () => null);

    await subject.loadAll(["jobs"]);

    expect(jobs.reads).toBe(0);
  });

  it("does not mark a failed read as loaded", async () => {
    let answer = false;
    const subject = datasets(
      { models: { scope: "environment", read: async () => answer } },
      () => ({ projectId: "p1", ref: REF }),
    );

    await subject.load("models");
    expect(subject.isLoaded("models")).toBe(false);

    answer = true;
    await subject.load("models");
    expect(subject.isLoaded("models")).toBe(true);
  });

  it("reads again on a reload, even though it is already loaded", async () => {
    const entries = counting("environment");
    const subject = datasets({ entries: entries.definition }, () => ({
      projectId: "p1",
      ref: REF,
    }));

    await subject.load("entries");
    await subject.reload("entries");

    // A reload answers a filter the user has just changed.
    expect(entries.reads).toBe(2);
  });

  it("forgets everything when the project changes", async () => {
    const stacks = counting("environment");
    const subject = datasets({ stacks: stacks.definition }, () => ({
      projectId: "p1",
      ref: REF,
    }));

    await subject.load("stacks");
    subject.clear();
    await subject.load("stacks");

    expect(stacks.reads).toBe(2);
  });

  it("ignores a dataset it has no reader for", async () => {
    const subject = datasets({}, () => ({ projectId: "p1", ref: REF }));

    await subject.loadAll(["nothing-like-this"]);

    expect(subject.isLoaded("nothing-like-this")).toBe(false);
  });
});
