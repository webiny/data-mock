import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import type { GenericRecord } from "~/shared/types.js";
import { faker } from "@faker-js/faker";
import type { IGeneratorGenerateParams } from "../types.js";
import { MaximumLengthValidator, MinimumLengthValidator } from "../validators/index.js";

export class ObjectGenerator extends BaseGenerator<GenericRecord> {
  public type = "object";

  public async generate({ field }: IGeneratorGenerateParams): Promise<GenericRecord | null> {
    const fields = field.settings?.fields;
    if (!fields?.length) {
      return null;
    }
    const values: GenericRecord = {};
    for (const field of fields) {
      const generator = this.getGeneratorByField(field);

      values[field.fieldId] = await generator.generate();
    }
    return values;
  }
}

export class MultiObjectGenerator extends BaseMultiGenerator<GenericRecord> {
  public type = "object";

  public async generate({
    field,
    getValidator,
  }: IGeneratorGenerateParams): Promise<GenericRecord[] | null> {
    const fields = field.settings?.fields;
    if (!fields?.length) {
      return null;
    }
    const total = faker.number.int({
      min: getValidator(MinimumLengthValidator).getListValue(1),
      max: getValidator(MaximumLengthValidator).getListValue(5),
    });
    return this.iterate(total, async () => {
      const values: GenericRecord = {};
      for (const field of fields) {
        const generator = this.getGeneratorByField(field);

        values[field.fieldId] = await generator.generate();
      }
      return values;
    });
  }
}
