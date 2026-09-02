import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import { faker } from "@faker-js/faker";
import { registry } from "../registry.js";
import type { IGeneratorGenerateParams } from "../types.js";
import { createTime } from "./date/createTime.js";
import { createDate } from "./date/createDate.js";
import { createDateTimeWithoutTimezone } from "../fields/date/createDateTimeWithoutTimezone.js";
import { createDateTimeWithTimezone } from "../fields/date/createDateTimeWithTimezone.js";
import {
  MaximumLengthValidator,
  MinimumLengthValidator,
  GreaterThanOrEqualDateValidator,
  LesserThanOrEqualDateValidator,
} from "../validators/index.js";

const createValue = (params: IGeneratorGenerateParams): string => {
  const { field, getValidator } = params;

  const gteValidator = getValidator(GreaterThanOrEqualDateValidator);
  const lteValidator = getValidator(LesserThanOrEqualDateValidator);
  const settings = field.settings || {};
  if (settings.type === "time") {
    return createTime({
      gteValidator,
      lteValidator,
    });
  } else if (settings.type === "date") {
    return createDate({
      gteValidator,
      lteValidator,
    });
  } else if (settings.type === "dateTimeWithoutTimezone") {
    return createDateTimeWithoutTimezone({
      gteValidator,
      lteValidator,
    });
  } else if (settings.type === "dateTimeWithTimezone") {
    return createDateTimeWithTimezone({
      gteValidator,
      lteValidator,
    });
  }
  return faker.date.anytime().toISOString();
};

class DateTimeGenerator extends BaseGenerator<string> {
  public readonly type: string = "datetime";

  public async generate(params: IGeneratorGenerateParams): Promise<string> {
    return createValue(params);
  }
}

class MultiDateTimeGenerator extends BaseMultiGenerator<string> {
  public readonly type: string = "datetime";

  public async generate(params: IGeneratorGenerateParams): Promise<string[]> {
    const { getValidator } = params;
    const total = faker.number.int({
      min: getValidator(MinimumLengthValidator).getListValue(1),
      max: getValidator(MaximumLengthValidator).getListValue(5),
    });
    return this.iterate(total, async () => {
      return createValue(params);
    });
  }
}

registry.registerGenerator(DateTimeGenerator);
registry.registerGenerator(MultiDateTimeGenerator);
