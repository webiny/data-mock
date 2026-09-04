import { BaseValidator } from "./BaseValidator.js";
import type { DateValidationSettings } from "./types.js";

export class LesserThanOrEqualDateValidator extends BaseValidator<string | undefined> {
  public getValue(def: string): string | undefined {
    const validation = this.getValidation<DateValidationSettings>("dateLte");
    if (validation?.settings?.value !== undefined) {
      return validation.settings.value;
    } else if (def !== undefined) {
      return def;
    }
    return undefined;
  }

  public getListValue(def: string): string | undefined {
    const validation = this.getListValidation<DateValidationSettings>("dateLte");
    if (validation?.settings?.value !== undefined) {
      return validation.settings.value;
    } else if (def !== undefined) {
      return def;
    }
    return undefined;
  }
}
