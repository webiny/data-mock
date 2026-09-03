import type { ApiCmsModelField } from "~/types.js";
import type { IValidation, IValidator } from "../types.js";
import zod from "zod";

const validationSchema = zod.object({
  name: zod.string(),
  message: zod.string(),
  settings: zod.object({}).passthrough().optional(),
});

export abstract class BaseValidator<T> implements IValidator<T> {
  public readonly field: ApiCmsModelField;

  public constructor(field: ApiCmsModelField) {
    this.field = field;
  }

  public abstract getValue(def?: T): T;
  public abstract getListValue(def?: T): T;

  public getValidation<T>(name: string): IValidation<T> | null {
    if (!this.field.validation?.length) {
      return null;
    }
    const value = this.field.validation.find((v) => v.name === name);

    const result = validationSchema.safeParse(value);
    if (result.success) {
      return value as IValidation<T>;
    }
    return null;
  }

  public getListValidation<T>(name: string): IValidation<T> | null {
    if (!this.field.listValidation?.length) {
      return null;
    }
    const value = this.field.listValidation.find((v) => v.name === name);

    const result = validationSchema.safeParse(value);
    if (result.success) {
      return value as IValidation<T>;
    }
    return null;
  }
}
