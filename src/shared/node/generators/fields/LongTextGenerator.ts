import { faker } from "@faker-js/faker";
import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import { MaximumLengthValidator, MinimumLengthValidator } from "../validators/index.js";
import { generateTextOfLength } from "./text/generateTextOfLength.js";
import type { IGeneratorGenerateParams } from "../types.js";

export class LongTextGenerator extends BaseGenerator<string> {
  public type = "long-text";

  public async generate({ getValidator }: IGeneratorGenerateParams): Promise<string> {
    return generateTextOfLength(
      getValidator(MinimumLengthValidator).getValue(1),
      getValidator(MaximumLengthValidator).getValue(250),
    );
  }
}

export class MultiLongTextGenerator extends BaseMultiGenerator<string> {
  public type = "long-text";

  public async generate(params: IGeneratorGenerateParams): Promise<string[]> {
    const { getValidator, field } = params;
    const total = faker.number.int({
      min: getValidator(MinimumLengthValidator).getListValue(1),
      max: getValidator(MaximumLengthValidator).getListValue(5),
    });
    return this.iterate(total, async () => {
      return this.getGenerator(LongTextGenerator).generate(field);
    });
  }
}
