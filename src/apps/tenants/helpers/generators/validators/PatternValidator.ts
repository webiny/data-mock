import { BaseValidator } from "./BaseValidator.js";
import type { PatternValidationSettings } from "./types.js";
import { registry } from "../registry.js";

export class PatternValidator extends BaseValidator<PatternValidationSettings | undefined> {
  public getValue(def?: PatternValidationSettings): PatternValidationSettings | undefined {
    const validation = this.getValidation<PatternValidationSettings>("pattern");

    return validation?.settings || def;
  }
  public getListValue(
    def?: PatternValidationSettings | undefined,
  ): PatternValidationSettings | undefined {
    return def;
  }
}

registry.registerValidator(PatternValidator);
