import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import type { GenericRecord } from "~/types.js";
import { faker } from "@faker-js/faker";
import { MaximumLengthValidator, MinimumLengthValidator } from "../validators/index.js";
import type { IGeneratorGenerateParams } from "../types.js";

const create = (): GenericRecord => {
  return {
    name: faker.lorem.words(3),
    description: faker.lorem.paragraph(),
    data: {
      key: faker.lorem.word(),
      value: faker.lorem.words(3),
    },
    value: faker.number.int(),
    is_active: faker.number.int() % 2,
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.past().toISOString(),
  };
};

export class JsonGenerator extends BaseGenerator<GenericRecord> {
  public type = "json";

  public async generate(): Promise<GenericRecord> {
    return create();
  }
}

export class MultiJsonGenerator extends BaseMultiGenerator<GenericRecord> {
  public type = "json";

  public async generate({ getValidator }: IGeneratorGenerateParams): Promise<GenericRecord[]> {
    const total = faker.number.int({
      min: getValidator(MinimumLengthValidator).getListValue(1),
      max: getValidator(MaximumLengthValidator).getListValue(5),
    });
    return this.iterate(total, async () => {
      return create();
    });
  }
}
