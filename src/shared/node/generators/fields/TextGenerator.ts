import { faker } from "@faker-js/faker";
import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import {
  MaximumLengthValidator,
  MinimumLengthValidator,
  PatternValidator,
} from "../validators/index.js";
import type { IGeneratorGenerateParams } from "../types.js";

function generateFromRegex(regex: string | undefined): string | null {
  if (!regex) {
    return null;
  }
  if (regex.includes("@") && regex.includes("\\.")) {
    return faker.internet.email();
  }
  if (regex.includes("https?://")) {
    return faker.internet.url();
  }
  if (regex.includes("\\d{4}-\\d{2}-\\d{2}")) {
    return faker.date.recent().toISOString().split("T")[0];
  }
  if (regex.includes("()\\.\\s") || regex.includes("[0-9()")) {
    return `+1${faker.string.numeric(10)}`;
  }
  if (/^\^?\[a-z0-9\]/.test(regex)) {
    return faker.helpers.slugify(faker.lorem.words(3)).toLowerCase();
  }
  return null;
}

export class TextGenerator extends BaseGenerator<string> {
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

    if (validation?.preset) {
      const preset = validation.preset.toLowerCase();
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
        case "custom": {
          const generated = generateFromRegex(validation.regex);
          if (generated) {
            return generated;
          }
          break;
        }
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

export class MultiTextGenerator extends BaseMultiGenerator<string> {
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
