import type { IValidatorsParams } from "./types.js";
import { faker } from "@faker-js/faker";

const format = (date: Date): string => {
  return date.toISOString();
};

export const createDateTimeWithoutTimezone = (params: IValidatorsParams): string => {
  const { gteValidator, lteValidator } = params;

  const gteValue = gteValidator.getValue();
  const lteValue = lteValidator.getValue();
  if (gteValue && lteValue) {
    return format(
      faker.date.between({
        from: gteValue,
        to: lteValue,
      }),
    );
  } else if (gteValue) {
    return format(
      faker.date.between({
        from: gteValue,
        to: faker.date.future({
          refDate: gteValue,
        }),
      }),
    );
  } else if (lteValue) {
    return format(
      faker.date.between({
        from: faker.date.past({
          refDate: lteValue,
        }),
        to: lteValue,
      }),
    );
  }
  return format(faker.date.anytime());
};
