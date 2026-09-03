import { faker } from "@faker-js/faker";
import { BaseGenerator } from "./BaseGenerator.js";

export class BooleanGenerator extends BaseGenerator<boolean> {
  public type = "boolean";

  public async generate(): Promise<boolean> {
    const value = faker.number.int({
      min: 1,
      max: 1000001,
    });
    return value % 2 === 0;
  }
}
