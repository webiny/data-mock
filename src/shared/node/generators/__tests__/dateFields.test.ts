import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { ConsoleLoggerFeature } from "@webiny/stdlib";
import { GeneratorFeature } from "../feature.js";
import { GeneratorRegistry } from "../abstractions/GeneratorRegistry.js";
import type { ApiCmsModelField } from "~/shared/types.js";

type DateType = "date" | "time" | "dateTimeWithoutTimezone" | "dateTimeWithTimezone";

function dateField(type: DateType, gte?: string, lte?: string): ApiCmsModelField {
  const validation: ApiCmsModelField["validation"] = [];
  if (gte !== undefined) {
    validation.push({ name: "dateGte", message: "too early", settings: { value: gte } });
  }
  if (lte !== undefined) {
    validation.push({ name: "dateLte", message: "too late", settings: { value: lte } });
  }

  return {
    id: "f1",
    fieldId: "publishedOn",
    storageId: "publishedOn",
    type: "datetime",
    list: false,
    settings: { type },
    predefinedValues: { enabled: false, values: [] },
    validation,
    listValidation: [],
  };
}

describe("date generators", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);
  });

  async function generate(field: ApiCmsModelField): Promise<string> {
    const registry = container.resolve(GeneratorRegistry);
    return (await registry.getGenerator({ field }).generate(field)) as string;
  }

  describe("date", () => {
    it("produces a plain date, with no time on it", async () => {
      const value = await generate(dateField("date"));

      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("stays between both bounds", async () => {
      for (let run = 0; run < 20; run++) {
        const value = await generate(dateField("date", "2024-01-01", "2024-01-31"));

        expect(value >= "2024-01-01").toBe(true);
        expect(value <= "2024-01-31").toBe(true);
      }
    });

    it("stays on or after a lower bound with no upper one", async () => {
      for (let run = 0; run < 20; run++) {
        expect(await generate(dateField("date", "2030-01-01"))).toMatch(/^20[3-9]\d-/);
      }
    });

    it("stays on or before an upper bound with no lower one", async () => {
      for (let run = 0; run < 20; run++) {
        expect((await generate(dateField("date", undefined, "2000-01-01"))) <= "2000-01-01").toBe(
          true,
        );
      }
    });
  });

  describe("time", () => {
    it("produces a time of day", async () => {
      expect(await generate(dateField("time"))).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it.each([
      ["with seconds", "09:00:00", "17:00:00"],
      ["without seconds", "09:00", "17:00"],
    ])("stays between both bounds, given them %s", async (_label, gte, lte) => {
      for (let run = 0; run < 20; run++) {
        const value = await generate(dateField("time", gte, lte));

        expect(value >= "09:00:00").toBe(true);
        expect(value <= "17:00:00").toBe(true);
      }
    });

    it("stays at or after a lower bound with no upper one", async () => {
      for (let run = 0; run < 20; run++) {
        expect((await generate(dateField("time", "20:00:00"))) >= "20:00:00").toBe(true);
      }
    });

    it("stays at or before an upper bound with no lower one", async () => {
      for (let run = 0; run < 20; run++) {
        expect((await generate(dateField("time", undefined, "04:00:00"))) <= "04:00:00").toBe(true);
      }
    });
  });

  describe("dateTimeWithoutTimezone", () => {
    it("produces an ISO timestamp", async () => {
      const value = await generate(dateField("dateTimeWithoutTimezone"));

      expect(Number.isNaN(Date.parse(value))).toBe(false);
    });

    it("stays between both bounds", async () => {
      for (let run = 0; run < 20; run++) {
        const value = Date.parse(
          await generate(
            dateField("dateTimeWithoutTimezone", "2024-01-01T00:00:00Z", "2024-01-31T00:00:00Z"),
          ),
        );

        expect(value).toBeGreaterThanOrEqual(Date.parse("2024-01-01T00:00:00Z"));
        expect(value).toBeLessThanOrEqual(Date.parse("2024-01-31T00:00:00Z"));
      }
    });

    it("stays at or after a lower bound with no upper one", async () => {
      for (let run = 0; run < 20; run++) {
        const value = Date.parse(
          await generate(dateField("dateTimeWithoutTimezone", "2030-01-01T00:00:00Z")),
        );

        expect(value).toBeGreaterThanOrEqual(Date.parse("2030-01-01T00:00:00Z"));
      }
    });

    it("stays at or before an upper bound with no lower one", async () => {
      for (let run = 0; run < 20; run++) {
        const value = Date.parse(
          await generate(dateField("dateTimeWithoutTimezone", undefined, "2000-01-01T00:00:00Z")),
        );

        expect(value).toBeLessThanOrEqual(Date.parse("2000-01-01T00:00:00Z"));
      }
    });
  });

  describe("dateTimeWithTimezone", () => {
    it("produces a timestamp carrying an offset", async () => {
      const value = await generate(dateField("dateTimeWithTimezone"));

      expect(Number.isNaN(Date.parse(value))).toBe(false);
      expect(value).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
    });

    it("stays between both bounds", async () => {
      for (let run = 0; run < 20; run++) {
        const value = Date.parse(
          await generate(
            dateField("dateTimeWithTimezone", "2024-01-01T00:00:00Z", "2024-01-31T00:00:00Z"),
          ),
        );

        expect(value).toBeGreaterThanOrEqual(Date.parse("2024-01-01T00:00:00Z"));
        expect(value).toBeLessThanOrEqual(Date.parse("2024-01-31T00:00:00Z"));
      }
    });
  });
});
