import { faker } from "@faker-js/faker";

/**
 * Lorem text whose **character** length lands between `min` and `max`.
 *
 * `minLength` and `maxLength` come from the CMS and count characters, but they were handed
 * straight to `faker.lorem.words({ min, max })`, which counts words. Two consequences: the value
 * only satisfied the field's own validators by accident, and `min > max` — a field with
 * `minLength: 30` and no `maxLength`, against a default of 25 — made faker throw, which failed
 * the entry and, through the seed's stop-on-first-failure rule, abandoned the rest of the model.
 *
 * A `max` below `min` is a contradiction the CMS should not have produced; the minimum wins,
 * because a value under it is the one the CMS will reject.
 */
export function generateTextOfLength(min: number, max: number): string {
  const lower = Math.max(0, Math.floor(min));
  const upper = Math.max(lower, Math.floor(max));
  const target = faker.number.int({ min: lower, max: upper });

  if (target === 0) {
    return "";
  }

  let value = faker.lorem.word();
  while (value.length < target) {
    value = `${value} ${faker.lorem.word()}`;
  }

  return value.slice(0, target);
}
