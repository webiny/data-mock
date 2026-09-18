import { describe, it, expect } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import { UpsertStackRepository } from "~/shared/node/features/environments/stacks/abstractions/UpsertStackRepository.js";
import { ListStacksRepository } from "~/shared/node/features/environments/stacks/abstractions/ListStacksRepository.js";
import { deriveEnvironmentState, mergeStackRead } from "../stackState.js";
import type { IStoredStackState } from "../stackState.js";

function stored(overrides: Partial<IStoredStackState> = {}): IStoredStackState {
  return {
    app: "core",
    deployed: true,
    resourceCount: 42,
    stackOutput: { "webiny-api-url": "https://api.example.com" },
    readState: "deployed",
    ...overrides,
  };
}

describe("mergeStackRead", () => {
  it("takes everything from a read that succeeded", () => {
    const merged = mergeStackRead("core", stored(), {
      readState: "deployed",
      deployed: true,
      resourceCount: 7,
      outputs: { region: "eu-central-1" },
    });

    expect(merged).toEqual({
      app: "core",
      deployed: true,
      resourceCount: 7,
      stackOutput: { region: "eu-central-1" },
      readState: "deployed",
    });
  });

  it("keeps the last known output when the stack could not be read", () => {
    const merged = mergeStackRead("core", stored(), {
      readState: "unknown",
      deployed: false,
      resourceCount: null,
      outputs: null,
    });

    // That output is the only record of what is deployed; writing nulls over it loses it.
    expect(merged.stackOutput).toEqual({ "webiny-api-url": "https://api.example.com" });
    expect(merged.resourceCount).toBe(42);
    expect(merged.readState).toBe("unknown");
  });

  it("clears the output of a stack that was destroyed", () => {
    const merged = mergeStackRead("core", stored(), {
      readState: "not-deployed",
      deployed: false,
      resourceCount: 0,
      outputs: null,
    });

    // Not the same as unreadable: this one is a real answer.
    expect(merged.stackOutput).toBeNull();
    expect(merged.deployed).toBe(false);
  });

  it("has nothing to keep for a stack seen for the first time", () => {
    const merged = mergeStackRead("api", null, {
      readState: "unknown",
      deployed: false,
      resourceCount: null,
      outputs: null,
    });

    expect(merged).toEqual({
      app: "api",
      deployed: false,
      resourceCount: null,
      stackOutput: null,
      readState: "unknown",
    });
  });
});

describe("deriveEnvironmentState", () => {
  it("is deployed when any one app is", () => {
    const derived = deriveEnvironmentState([
      stored({ app: "core", deployed: true }),
      stored({ app: "admin", deployed: false, stackOutput: null }),
    ]);

    expect(derived.deployed).toBe(true);
  });

  it("reads no URL out of a stack that is not deployed", () => {
    const derived = deriveEnvironmentState([
      stored({
        app: "api",
        deployed: false,
        stackOutput: { apiUrl: "https://api.example.com" },
      }),
    ]);

    // A destroyed stack keeps its last output; reporting it would show a torn-down API as live.
    expect(derived.apiUrl).toBeNull();
  });

  it("falls back to core for the region when api has none", () => {
    const derived = deriveEnvironmentState([
      stored({ app: "api", stackOutput: {} }),
      stored({ app: "core", stackOutput: { region: "eu-central-1" } }),
    ]);

    expect(derived.region).toBe("eu-central-1");
  });

  it("reports nothing for an environment with no stacks", () => {
    expect(deriveEnvironmentState([])).toEqual({
      deployed: false,
      apiUrl: null,
      adminUrl: null,
      region: null,
    });
  });
});

describe("UpsertStackRepository", () => {
  it("writes what mergeStackRead decides, so a preview predicts the row", async () => {
    const tc = createTestContainer();
    try {
      const { environmentId } = await createTestProject(tc);
      const upsert = tc.container.resolve(UpsertStackRepository);
      const list = tc.container.resolve(ListStacksRepository);

      await upsert.execute({
        environmentId,
        app: "core",
        readState: "deployed",
        deployed: true,
        resourceCount: 42,
        stackOutput: { "webiny-api-url": "https://api.example.com" },
      });

      await upsert.execute({
        environmentId,
        app: "core",
        readState: "unknown",
        deployed: false,
        resourceCount: null,
        stackOutput: null,
      });

      const stacks = await list.execute({ environmentId });
      const core = stacks.isOk() ? stacks.value.find((stack) => stack.app === "core") : undefined;

      expect(core).toMatchObject({
        readState: "unknown",
        deployed: false,
        resourceCount: 42,
        stackOutput: { "webiny-api-url": "https://api.example.com" },
      });
    } finally {
      tc.cleanup();
    }
  });
});
