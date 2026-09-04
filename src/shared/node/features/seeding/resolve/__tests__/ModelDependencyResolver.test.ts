import { describe, it, expect } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ModelDependencyResolver } from "../abstractions/ModelDependencyResolver.js";
import type { ProjectModel, ApiCmsModelField } from "~/shared/types.js";

function makeField(
  fieldId: string,
  type: string,
  settings?: Record<string, unknown>,
): ApiCmsModelField {
  return {
    id: fieldId,
    fieldId,
    storageId: fieldId,
    type,
    list: false,
    settings: settings ?? {},
    predefinedValues: { enabled: false, values: [] },
    validation: [],
    listValidation: [],
  };
}

function makeModel(modelId: string, fields: ApiCmsModelField[]): ProjectModel {
  return {
    id: modelId,
    projectId: "test-project",
    groupSlug: "test",
    modelId,
    name: modelId,
    singularApiName: modelId.charAt(0).toUpperCase() + modelId.slice(1),
    pluralApiName: modelId.charAt(0).toUpperCase() + modelId.slice(1) + "s",
    description: null,
    fields,
    plugin: false,
    remoteId: null,
    syncedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("ModelDependencyResolver", () => {
  it("should order models by dependencies (dependencies first)", () => {
    const tc = createTestContainer();
    try {
      const resolver = tc.container.resolve(ModelDependencyResolver);

      const article = makeModel("article", [
        makeField("title", "text"),
        makeField("author", "ref", { models: [{ modelId: "author" }] }),
        makeField("category", "ref", { models: [{ modelId: "category" }] }),
      ]);
      const author = makeModel("author", [makeField("name", "text")]);
      const category = makeModel("category", [makeField("title", "text")]);

      const result = resolver.execute({ models: [article, author, category] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const order = result.value.ordered.map((m) => m.modelId);
        expect(order.indexOf("author")).toBeLessThan(order.indexOf("article"));
        expect(order.indexOf("category")).toBeLessThan(order.indexOf("article"));
        expect(result.value.circular).toHaveLength(0);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should detect circular dependencies", () => {
    const tc = createTestContainer();
    try {
      const resolver = tc.container.resolve(ModelDependencyResolver);

      const a = makeModel("modelA", [
        makeField("refB", "ref", { models: [{ modelId: "modelB" }] }),
      ]);
      const b = makeModel("modelB", [
        makeField("refA", "ref", { models: [{ modelId: "modelA" }] }),
      ]);

      const result = resolver.execute({ models: [a, b] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.circular.length).toBeGreaterThan(0);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should handle models with no dependencies", () => {
    const tc = createTestContainer();
    try {
      const resolver = tc.container.resolve(ModelDependencyResolver);

      const m1 = makeModel("model1", [makeField("name", "text")]);
      const m2 = makeModel("model2", [makeField("count", "number")]);

      const result = resolver.execute({ models: [m1, m2] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.ordered).toHaveLength(2);
        expect(result.value.circular).toHaveLength(0);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should find refs nested inside object fields", () => {
    const tc = createTestContainer();
    try {
      const resolver = tc.container.resolve(ModelDependencyResolver);

      const parent = makeModel("parent", [
        makeField("nested", "object", {
          fields: [makeField("authorRef", "ref", { models: [{ modelId: "author" }] })],
        }),
      ]);
      const author = makeModel("author", [makeField("name", "text")]);

      const result = resolver.execute({ models: [parent, author] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const order = result.value.ordered.map((m) => m.modelId);
        expect(order.indexOf("author")).toBeLessThan(order.indexOf("parent"));
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should find refs nested inside dynamic zone templates", () => {
    const tc = createTestContainer();
    try {
      const resolver = tc.container.resolve(ModelDependencyResolver);

      const page = makeModel("page", [
        makeField("content", "dynamicZone", {
          templates: [
            {
              name: "hero",
              gqlTypeName: "Hero",
              fields: [
                makeField("image", "file"),
                makeField("cta", "ref", { models: [{ modelId: "link" }] }),
              ],
            },
            {
              name: "text",
              gqlTypeName: "Text",
              fields: [makeField("body", "rich-text")],
            },
          ],
        }),
      ]);
      const link = makeModel("link", [makeField("url", "text")]);

      const result = resolver.execute({ models: [page, link] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const order = result.value.ordered.map((m) => m.modelId);
        expect(order.indexOf("link")).toBeLessThan(order.indexOf("page"));
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should find refs deeply nested (object inside dynamic zone)", () => {
    const tc = createTestContainer();
    try {
      const resolver = tc.container.resolve(ModelDependencyResolver);

      const page = makeModel("page", [
        makeField("content", "dynamicZone", {
          templates: [
            {
              name: "section",
              gqlTypeName: "Section",
              fields: [
                makeField("wrapper", "object", {
                  fields: [makeField("ref", "ref", { models: [{ modelId: "category" }] })],
                }),
              ],
            },
          ],
        }),
      ]);
      const category = makeModel("category", [makeField("title", "text")]);

      const result = resolver.execute({ models: [page, category] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const order = result.value.ordered.map((m) => m.modelId);
        expect(order.indexOf("category")).toBeLessThan(order.indexOf("page"));
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should ignore refs to models not in the input set", () => {
    const tc = createTestContainer();
    try {
      const resolver = tc.container.resolve(ModelDependencyResolver);

      const m = makeModel("article", [
        makeField("externalRef", "ref", { models: [{ modelId: "unknownModel" }] }),
      ]);

      const result = resolver.execute({ models: [m] });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.ordered).toHaveLength(1);
        expect(result.value.circular).toHaveLength(0);
      }
    } finally {
      tc.cleanup();
    }
  });
});
