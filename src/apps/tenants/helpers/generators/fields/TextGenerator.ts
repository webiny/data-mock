import { faker } from "@faker-js/faker";
import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import { registry } from "../registry.js";
import {
  MaximumLengthValidator,
  MinimumLengthValidator,
  PatternValidator,
} from "../validators/index.js";
import type { IGeneratorGenerateParams } from "../types.js";
import { logger } from "~/logger.js";

class TextGenerator extends BaseGenerator<string> {
  public type = "text";

  public async generate(params: IGeneratorGenerateParams): Promise<string | null> {
    const { field, getValidator } = params;

    const values = field.predefinedValues?.values;
    if (values?.length) {
      const target = faker.number.int({
        min: 0,
        max: values.length - 1,
      });
      return values[target].value;
    }

    const validation = getValidator(PatternValidator).getValue();

    if (validation) {
      const preset = (validation?.preset || "unknown").toLowerCase();
      switch (preset) {
        case "email":
          return faker.internet.email();
        case "url":
          return faker.internet.url();
        case "uppercase":
        case "uppercasespace":
          return faker.word.words(1).toUpperCase();
        case "lowercase":
        case "lowercasespace":
          return faker.word.words(1).toLowerCase();
        default:
          logger.warn(`There is no pattern preset generator for "${preset}"`);
          return null;
      }
    }

    const options = {
      min: getValidator(MinimumLengthValidator).getValue(1),
      max: getValidator(MaximumLengthValidator).getValue(100),
    };

    const value = faker.lorem.words(options);

    return value.length > options.max ? value.slice(0, options.max) : value;
  }
}

class MultiTextGenerator extends BaseMultiGenerator<string> {
  public type = "text";

  public async generate(params: IGeneratorGenerateParams): Promise<string[]> {
    const { field, getValidator } = params;

    const total = faker.number.int({
      min: getValidator(MinimumLengthValidator).getListValue(1),
      max: getValidator(MaximumLengthValidator).getListValue(2),
    });
    return await this.iterate(total, async () => {
      return await this.getGenerator(TextGenerator).generate(field);
    });
  }
}

registry.registerGenerator(TextGenerator);
registry.registerGenerator(MultiTextGenerator);
