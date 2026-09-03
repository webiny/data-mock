import { describe, it, expect, vi, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { GeneratorRegistry } from "../abstractions/GeneratorRegistry.js";
import { createSingleEntryVariables, createEntryVariables } from "../createEntryVariables.js";
import type { ApiCmsModelField } from "~/shared/types.js";
import type { Logger } from "@webiny/stdlib";

const containers: Array<{ cleanup(): void }> = [];

function setup() {
  const tc = createTestContainer();
  containers.push(tc);
  return tc;
}

afterEach(() => {
  for (const tc of containers) {
    tc.cleanup();
  }
  containers.length = 0;
});

function createField(type: string, fieldId: string): ApiCmsModelField {
  return {
    id: fieldId,
    fieldId,
    storageId: fieldId,
    type,
    list: false,
    settings: {},
    predefinedValues: { enabled: false, values: [] },
    validation: [],
    listValidation: [],
  } as ApiCmsModelField;
}

const mockLogger: Logger.Interface = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

describe("createEntryVariables", () => {
  describe("createSingleEntryVariables", () => {
    it("should generate values for each field in the model", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);

      const entry = await createSingleEntryVariables(registry, {
        fields: [createField("text", "title"), createField("number", "count")],
      });

      expect(entry.values).toBeDefined();
      expect("title" in entry.values).toBe(true);
      expect("count" in entry.values).toBe(true);
    });

    it("should return empty values for model with no fields", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);

      const entry = await createSingleEntryVariables(registry, { fields: [] });

      expect(entry.values).toEqual({});
    });

    it("should pass availableRefs through to generators", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const refs = new Map<string, string[]>();
      refs.set("someModel", ["entry1", "entry2"]);

      const refField = createField("ref", "related");
      refField.settings = { models: [{ modelId: "someModel" }] };

      const entry = await createSingleEntryVariables(registry, { fields: [refField] }, refs);

      expect(entry.values).toBeDefined();
      expect("related" in entry.values).toBe(true);
    });
  });

  describe("createEntryVariables (batch)", () => {
    it("should generate the requested amount of entries", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);

      const entries = await createEntryVariables(
        registry,
        mockLogger,
        { fields: [createField("text", "name")] },
        5,
      );

      expect(entries).toHaveLength(5);
      for (const entry of entries) {
        expect("name" in entry.values).toBe(true);
      }
    });

    it("should generate zero entries when amount is 0", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);

      const entries = await createEntryVariables(
        registry,
        mockLogger,
        { fields: [createField("text", "name")] },
        0,
      );

      expect(entries).toHaveLength(0);
    });

    it("should log and rethrow errors", async () => {
      const badRegistry = {
        getGenerator: () => ({
          generate: () => {
            throw new Error("Generator exploded");
          },
        }),
        registerGenerator: vi.fn(),
        registerValidator: vi.fn(),
      } as unknown as GeneratorRegistry.Interface;

      await expect(
        createEntryVariables(badRegistry, mockLogger, { fields: [createField("text", "name")] }, 1),
      ).rejects.toThrow("Generator exploded");

      expect(mockLogger.error).toHaveBeenCalledWith("Generator exploded");
    });
  });
});
