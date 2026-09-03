import type { IValidatorsParams } from "./types.js";
import { faker } from "@faker-js/faker";

const format = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const timezoneOffset = -date.getTimezoneOffset();
  const sign = timezoneOffset >= 0 ? "+" : "-";
  const absOffset = Math.abs(timezoneOffset);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMinutes = String(absOffset % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
};

export const createDateTimeWithTimezone = (params: IValidatorsParams): string => {
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
