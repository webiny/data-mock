import { faker } from "@faker-js/faker";
import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import { MaximumLengthValidator, MinimumLengthValidator } from "../validators/index.js";
import type { IGeneratorGenerateParams } from "../types.js";

export class FileGenerator extends BaseGenerator<string> {
  public type = "file";

  public async generate({ filePool }: IGeneratorGenerateParams): Promise<string> {
    if (filePool && filePool.length > 0) {
      const file = faker.helpers.arrayElement(filePool);
      return file.fileUrl;
    }
    return faker.internet.url({ protocol: "https" });
  }
}

export class MultiFileGenerator extends BaseMultiGenerator<string> {
  public type = "file";

  public async generate({ getValidator, filePool }: IGeneratorGenerateParams): Promise<string[]> {
    const total = faker.number.int({
      min: getValidator(MinimumLengthValidator).getListValue(1),
      max: getValidator(MaximumLengthValidator).getListValue(5),
    });
    return this.iterate(total, async () => {
      if (filePool && filePool.length > 0) {
        const file = faker.helpers.arrayElement(filePool);
        return file.fileUrl;
      }
      return faker.internet.url({ protocol: "https" });
    });
  }
}
