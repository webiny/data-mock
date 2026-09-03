import type {
  IFieldRegistryGenerator,
  IGenerator,
  IGeneratorGenerateParams,
  IRegistryGenerator,
  IRegistryRegisterGeneratorConstructorParams,
} from "../types.js";
import type { ApiCmsModelField } from "~/types.js";
import { faker } from "@faker-js/faker";

export type IBaseGeneratorParams = IRegistryRegisterGeneratorConstructorParams;

export abstract class BaseGenerator<T = unknown> implements IGenerator<T | null> {
  public abstract readonly type: string;
  public list = false;

  protected readonly getGenerator: <T extends IGenerator<unknown>>(type: {
    new (params: IBaseGeneratorParams): T;
  }) => IRegistryGenerator<T>;
  protected readonly getGeneratorByField: <T extends IGenerator<unknown>>(
    field: ApiCmsModelField,
  ) => IFieldRegistryGenerator<T>;

  public constructor(params: IBaseGeneratorParams) {
    this.getGenerator = params.getGenerator;
    this.getGeneratorByField = params.getGeneratorByField;
  }

  public abstract generate(params: IGeneratorGenerateParams): Promise<T | null>;
}

export interface IIterateOptions {
  min: number;
  max: number;
}

export abstract class BaseMultiGenerator<T = unknown> extends BaseGenerator<T[]> {
  public override readonly list = true;

  public abstract generate(params: IGeneratorGenerateParams): Promise<T[] | null>;

  public async iterate<R>(
    amount: number | IIterateOptions,
    cb: (current: number) => Promise<R | null>,
  ): Promise<R[]> {
    amount = typeof amount === "number" ? amount : faker.number.int(amount);
    const results = await Promise.all(
      Array(amount)
        .fill(0)
        .map(async (_, index) => {
          return await cb(index);
        }),
    );

    return results.filter((result): result is Awaited<R> => {
      return result !== null && result !== undefined;
    });
  }
}
