import { describe, it, expect } from "vitest";
import { GreaterThanOrEqualDateValidator } from "../validators/GreaterThanOrEqualDateValidator.js";
import { LesserThanOrEqualDateValidator } from "../validators/LesserThanOrEqualDateValidator.js";
import { MaximumLengthValidator } from "../validators/MaximumLengthValidator.js";
import { MinimumLengthValidator } from "../validators/MinimumLengthValidator.js";
import { PatternValidator } from "../validators/PatternValidator.js";
import type { ApiCmsModelField } from "~/shared/types.js";

function createField(overrides?: Partial<ApiCmsModelField>): ApiCmsModelField {
  return {
    id: "field1",
    fieldId: "field1",
    storageId: "field1",
    type: "text",
    list: false,
    settings: {},
    predefinedValues: { enabled: false, values: [] },
    validation: [],
    listValidation: [],
    ...overrides,
  } as ApiCmsModelField;
}

describe("Validators", () => {
  describe("GreaterThanOrEqualDateValidator", () => {
    it("should return validation value when dateGte validation exists", () => {
      const field = createField({
        validation: [{ name: "dateGte", message: "too early", settings: { value: "2024-01-01" } }],
      });
      const validator = new GreaterThanOrEqualDateValidator(field);
      expect(validator.getValue()).toBe("2024-01-01");
    });

    it("should return default when no dateGte validation", () => {
      const field = createField();
      const validator = new GreaterThanOrEqualDateValidator(field);
      expect(validator.getValue("2023-01-01")).toBe("2023-01-01");
    });

    it("should return undefined when no validation and no default", () => {
      const field = createField();
      const validator = new GreaterThanOrEqualDateValidator(field);
      expect(validator.getValue()).toBeUndefined();
    });

    it("should handle getListValue with listValidation", () => {
      const field = createField({
        listValidation: [
          { name: "dateGte", message: "too early", settings: { value: "2024-06-01" } },
        ],
      });
      const validator = new GreaterThanOrEqualDateValidator(field);
      expect(validator.getListValue()).toBe("2024-06-01");
    });

    it("should return default for getListValue when no list validation", () => {
      const field = createField();
      const validator = new GreaterThanOrEqualDateValidator(field);
      expect(validator.getListValue("2023-06-01")).toBe("2023-06-01");
    });
  });

  describe("LesserThanOrEqualDateValidator", () => {
    it("should return validation value when dateLte validation exists", () => {
      const field = createField({
        validation: [{ name: "dateLte", message: "too late", settings: { value: "2025-12-31" } }],
      });
      const validator = new LesserThanOrEqualDateValidator(field);
      expect(validator.getValue("")).toBe("2025-12-31");
    });

    it("should return default when no dateLte validation", () => {
      const field = createField();
      const validator = new LesserThanOrEqualDateValidator(field);
      expect(validator.getValue("2025-01-01")).toBe("2025-01-01");
    });

    it("should handle getListValue with listValidation", () => {
      const field = createField({
        listValidation: [
          { name: "dateLte", message: "too late", settings: { value: "2025-06-30" } },
        ],
      });
      const validator = new LesserThanOrEqualDateValidator(field);
      expect(validator.getListValue("")).toBe("2025-06-30");
    });

    it("should return default for getListValue when no list validation", () => {
      const field = createField();
      const validator = new LesserThanOrEqualDateValidator(field);
      expect(validator.getListValue("2025-06-30")).toBe("2025-06-30");
    });
  });

  describe("MinimumLengthValidator", () => {
    it("should return validation value when minLength validation exists", () => {
      const field = createField({
        validation: [{ name: "minLength", message: "too short", settings: { value: 5 } }],
      });
      const validator = new MinimumLengthValidator(field);
      expect(validator.getValue(0)).toBe(5);
    });

    it("should return default when no minLength validation", () => {
      const field = createField();
      const validator = new MinimumLengthValidator(field);
      expect(validator.getValue(3)).toBe(3);
    });
  });

  describe("MaximumLengthValidator", () => {
    it("should return validation value when maxLength validation exists", () => {
      const field = createField({
        validation: [{ name: "maxLength", message: "too long", settings: { value: 100 } }],
      });
      const validator = new MaximumLengthValidator(field);
      expect(validator.getValue(0)).toBe(100);
    });

    it("should return default when no maxLength validation", () => {
      const field = createField();
      const validator = new MaximumLengthValidator(field);
      expect(validator.getValue(50)).toBe(50);
    });
  });

  describe("PatternValidator", () => {
    it("should return validation pattern when pattern validation exists", () => {
      const field = createField({
        validation: [
          {
            name: "pattern",
            message: "bad pattern",
            settings: { preset: "email", regex: "", flags: "" },
          },
        ],
      });
      const validator = new PatternValidator(field);
      const result = validator.getValue();
      expect(result).toBeDefined();
    });

    it("should return undefined when no pattern validation", () => {
      const field = createField();
      const validator = new PatternValidator(field);
      expect(validator.getValue()).toBeUndefined();
    });
  });
});
