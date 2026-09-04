import { faker } from "@faker-js/faker";
import type { IValidatorsParams } from "./types.js";

const format = (date: Date): string => {
  return date.toISOString().substring(0, 10);
};

export const createDate = (params: IValidatorsParams): string => {
  const { gteValidator, lteValidator } = params;

  const refDate = faker.date.anytime().toISOString();

  const attachDate = (input: string | undefined): string | undefined => {
    if (!input) {
      return undefined;
    }
    return `${input}${refDate.substring(10)}`;
  };

  const gteValue = attachDate(gteValidator.getValue());
  const lteValue = attachDate(lteValidator.getValue());
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
