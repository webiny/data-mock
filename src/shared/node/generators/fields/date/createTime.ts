import type { IValidatorsParams } from "./types.js";
import { faker } from "@faker-js/faker";

const format = (date: Date): string => {
  return date.toISOString().substring(11, 19);
};

export const createTime = (params: IValidatorsParams): string => {
  const { gteValidator, lteValidator } = params;

  const refTime = faker.date.anytime().toISOString();

  const attachTime = (input: string | undefined): string | undefined => {
    if (!input) {
      return undefined;
    }
    return `${refTime.substring(0, 11)}${input}:00${refTime.substring(19)}`;
  };

  const gteValue = attachTime(gteValidator.getValue());
  const lteValue = attachTime(lteValidator.getValue());
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
