import type { IValidatorsParams } from "./types.js";
import { faker } from "@faker-js/faker";

const DAY_START = "00:00:00";
const DAY_END = "23:59:59";

const format = (date: Date): string => {
  return date.toISOString().substring(11, 19);
};

/**
 * A time of day, inside whatever bounds the field carries.
 *
 * Both bounds are placed on the same arbitrary day and the value is drawn between them. A
 * one-sided bound is completed with the start or the end of that day rather than with
 * `faker.date.future`/`past`, which move by days: the time of day then came out unconstrained, so
 * a field with only `dateGte: "20:00"` produced values its own validator rejects.
 */
export const createTime = (params: IValidatorsParams): string => {
  const { gteValidator, lteValidator } = params;

  const refTime = faker.date.anytime().toISOString();

  /** A bound arrives as `HH:mm` or as `HH:mm:ss`; a Webiny time field stores seconds. */
  const withSeconds = (input: string): string => {
    return input.split(":").length === 2 ? `${input}:00` : input;
  };

  const onRefDay = (input: string): string => {
    return `${refTime.substring(0, 11)}${withSeconds(input)}${refTime.substring(19)}`;
  };

  const gteValue = gteValidator.getValue();
  const lteValue = lteValidator.getValue();

  if (!gteValue && !lteValue) {
    return format(faker.date.anytime());
  }

  return format(
    faker.date.between({
      from: onRefDay(gteValue ?? DAY_START),
      to: onRefDay(lteValue ?? DAY_END),
    }),
  );
};
