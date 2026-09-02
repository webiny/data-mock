import { faker } from "@faker-js/faker";
import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import { registry } from "../registry.js";
import { MaximumLengthValidator, MinimumLengthValidator } from "../validators/index.js";
import type { IGeneratorGenerateParams } from "../types.js";

class FileGenerator extends BaseGenerator<string> {
  public type = "file";

  public async generate(): Promise<string> {
    return faker.internet.url({
      protocol: "https",
    });
  }
}

class MultiFileGenerator extends BaseMultiGenerator<string> {
  public type = "file";

  public async generate({ getValidator }: IGeneratorGenerateParams): Promise<string[]> {
    const total = faker.number.int({
      min: getValidator(MinimumLengthValidator).getListValue(1),
      max: getValidator(MaximumLengthValidator).getListValue(5),
    });
    return this.iterate(total, async () => {
      return faker.internet.url({
        protocol: "https",
      });
    });
  }
}

registry.registerGenerator(FileGenerator);
registry.registerGenerator(MultiFileGenerator);
