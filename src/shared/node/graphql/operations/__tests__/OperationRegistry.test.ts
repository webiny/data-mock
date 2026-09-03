import { describe, it, expect } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { OperationRegistry } from "../abstractions/OperationRegistry.js";
import type { IGraphQLOperation } from "../types.js";

function createOp(name: string, query: string = "query { test }"): IGraphQLOperation<void, string> {
  return {
    name,
    query,
    path: "/cms/manage",
    getResult: (json) => ({ data: json.data["test"] as string }),
  };
}

describe("OperationRegistry", () => {
  it("should resolve from container", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);
    expect(registry).toBeDefined();
    tc.cleanup();
  });

  it("should resolve exact version match", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    const op = createOp("testOp", "exact-query");
    registry.register("6.4.9", op);

    const resolved = registry.resolve("testOp", "6.4.9");
    expect(resolved.query).toBe("exact-query");
    tc.cleanup();
  });

  it("should fall back to nearest lower version", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    registry.register("6.0.0", createOp("testOp", "base-query"));
    registry.register("6.2.0", createOp("testOp", "v620-query"));

    const resolved = registry.resolve("testOp", "6.3.5");
    expect(resolved.query).toBe("v620-query");
    tc.cleanup();
  });

  it("should fall back to base version when no closer match", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    registry.register("6.0.0", createOp("testOp", "base-query"));

    const resolved = registry.resolve("testOp", "6.9.9");
    expect(resolved.query).toBe("base-query");
    tc.cleanup();
  });

  it("should prefer higher version override over base", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    registry.register("6.0.0", createOp("testOp", "base-query"));
    registry.register("6.4.0", createOp("testOp", "v640-query"));
    registry.register("6.4.9", createOp("testOp", "v649-query"));

    const resolved = registry.resolve("testOp", "6.4.9");
    expect(resolved.query).toBe("v649-query");
    tc.cleanup();
  });

  it("should not resolve a version higher than requested", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    registry.register("7.0.0", createOp("testOp", "v7-query"));

    expect(() => registry.resolve("testOp", "6.4.9")).toThrow(
      'No compatible operation "testOp" for version "6.4.9"',
    );
    tc.cleanup();
  });

  it("should throw for unknown operation name", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    expect(() => registry.resolve("nonExistent", "6.0.0")).toThrow(
      'No operations registered for "nonExistent"',
    );
    tc.cleanup();
  });

  it("should have base operations pre-registered", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    const ops = [
      "listContentModelGroups",
      "listContentModels",
      "createContentEntry",
      "listContentEntries",
      "listTenants",
    ];

    for (const name of ops) {
      const op = registry.resolve(name, "6.0.0");
      expect(op).toBeDefined();
      expect(op.name).toBe(name);
    }
    tc.cleanup();
  });

  it("should resolve 6.4.0 override for listContentModels when requesting 6.4.9", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    const op = registry.resolve("listContentModels", "6.4.9");
    expect(op.name).toBe("listContentModels");
    expect(op.query).toContain("description");
    tc.cleanup();
  });

  it("should resolve base listContentModels for version 6.1.0 (no override)", () => {
    const tc = createTestContainer();
    const registry = tc.container.resolve(OperationRegistry);

    const op = registry.resolve("listContentModels", "6.1.0");
    expect(op.name).toBe("listContentModels");
    expect(op.query).not.toContain("description");
    tc.cleanup();
  });
});
