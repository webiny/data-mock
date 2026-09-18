import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { Logger, ConsoleLoggerFeature } from "@webiny/stdlib";
import { GeneratorFeature } from "../feature.js";
import { GeneratorRegistry } from "../abstractions/GeneratorRegistry.js";
import { generateTextOfLength } from "../fields/text/generateTextOfLength.js";
import type { ApiCmsModelField } from "~/shared/types.js";

function lengthField(
  type: string,
  min?: number,
  max?: number,
  overrides: Partial<ApiCmsModelField> = {},
): ApiCmsModelField {
  const validation: ApiCmsModelField["validation"] = [];
  if (min !== undefined) {
    validation.push({ name: "minLength", message: "too short", settings: { value: min } });
  }
  if (max !== undefined) {
    validation.push({ name: "maxLength", message: "too long", settings: { value: max } });
  }

  return {
    id: "f1",
    fieldId: "body",
    storageId: "body",
    type,
    list: false,
    settings: {},
    predefinedValues: { enabled: false, values: [] },
    validation,
    listValidation: [],
    ...overrides,
  };
}

describe("generateTextOfLength", () => {
  it("lands inside the range it was given", () => {
    for (let run = 0; run < 50; run++) {
      const value = generateTextOfLength(10, 20);
      expect(value.length).toBeGreaterThanOrEqual(10);
      expect(value.length).toBeLessThanOrEqual(20);
    }
  });

  it("hits an exact length when the range is one value", () => {
    expect(generateTextOfLength(40, 40)).toHaveLength(40);
  });

  it("keeps the minimum when the maximum is below it", () => {
    // A contradiction the CMS should not produce. A value under the minimum is the one it rejects.
    expect(generateTextOfLength(30, 5)).toHaveLength(30);
  });

  it("produces an empty string when nothing is asked for", () => {
    expect(generateTextOfLength(0, 0)).toBe("");
  });

  it("reaches a length no single lorem word would", () => {
    expect(generateTextOfLength(400, 400)).toHaveLength(400);
  });
});

describe("text generators honour the CMS length validators", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    ConsoleLoggerFeature.register(container);
    container.resolve(Logger);
    GeneratorFeature.register(container);
  });

  async function generate(field: ApiCmsModelField): Promise<string> {
    const registry = container.resolve(GeneratorRegistry);
    return (await registry.getGenerator({ field }).generate(field)) as string;
  }

  it.each(["text", "long-text"])("respects a %s field's minimum and maximum", async (type) => {
    const value = await generate(lengthField(type, 60, 80));

    expect(value.length).toBeGreaterThanOrEqual(60);
    expect(value.length).toBeLessThanOrEqual(80);
  });

  it.each(["text", "long-text"])(
    "generates a %s field whose minimum exceeds the default maximum",
    async (type) => {
      /**
       * The minimum was passed to faker as a word count against a default maximum of 25 for
       * long-text, so faker threw "Max 25 should be greater than min 200" — which failed the entry
       * and, with the seed stopping a model at its first failure, abandoned the rest of it.
       */
      const value = await generate(lengthField(type, 200));

      expect(value.length).toBeGreaterThanOrEqual(200);
    },
  );

  it.each(["text", "long-text"])("generates a %s field with no validators at all", async (type) => {
    const value = await generate(lengthField(type));

    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("keeps a text field's predefined values ahead of the length rules", async () => {
    const field = lengthField("text", 60, 80, {
      predefinedValues: {
        enabled: true,
        values: [{ label: "Draft", value: "draft", selected: false }],
      },
    });

    expect(await generate(field)).toBe("draft");
  });
});
