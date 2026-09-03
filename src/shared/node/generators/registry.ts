import type {
  IFieldRegistryGenerator,
  IGenerator,
  IGeneratorRegistry,
  IRegistryGenerator,
  IRegistryGetGeneratorParams,
  IRegistryRegisterGeneratorConstructor,
  IValidator,
  IValidatorConstructor,
} from "./types.js";
import type { ApiCmsModelField } from "~/shared/types.js";
import { createCacheKey, createMemoryCache } from "~/shared/node/cache/index.js";
import { Logger } from "@webiny/stdlib";
import { GeneratorRegistry as Abstraction } from "./abstractions/GeneratorRegistry.js";

class GeneratorRegistryImpl implements IGeneratorRegistry {
  public generators: IGenerator<unknown>[] = [];
  public validators: IValidatorConstructor<unknown>[] = [];
  private readonly validatorsCache = createMemoryCache();

  public constructor(private readonly logger: Logger.Interface) {}

  public registerValidator<T>(validator: IValidatorConstructor<T>): void {
    this.validators.push(validator);
  }

  public registerGenerator(generatorConstructor: IRegistryRegisterGeneratorConstructor): void {
    const generator = new generatorConstructor({
      logger: this.logger,
      getGenerator: <T extends IGenerator<unknown>>(type: { new (): T }): IRegistryGenerator<T> => {
        for (const generator of this.generators) {
          if (generator instanceof type) {
            return this.createRegistryGenerator<T>(generator);
          }
        }
        const name = type.constructor?.name || type.name || type || typeof type;
        throw new Error(`Generator for type "${name}" not found!`);
      },
      getGeneratorByField: <T extends IGenerator<unknown>>(
        field: ApiCmsModelField,
      ): IFieldRegistryGenerator<T> => {
        const generator = this.getGenerator<T>({
          field,
        });

        return {
          // @ts-expect-error - field type mismatch is expected here
          generate: async () => {
            return generator.generate(field);
          },
        };
      },
    });
    this.generators.push(generator);
  }

  public getGenerator<T extends IGenerator<unknown>>(
    params: IRegistryGetGeneratorParams,
  ): IRegistryGenerator<T> {
    const { field } = params;

    const type = field.type.split(":")[0];
    const list = !!field.list;

    const generator = this.generators.find((generator) => {
      return generator.type === type && generator.list === list;
    }) as T | undefined;
    if (!generator) {
      this.logger.error(
        `Generator for type "${type}", multiple values "${list ? "true" : "false"}" not found! Skipping...`,
      );
      return this.getNullGenerator();
    }
    return this.createRegistryGenerator<T>(generator);
  }

  private getValidator<V>(
    field: ApiCmsModelField,
    validatorConstructor: IValidatorConstructor<V>,
  ): IValidator<V> {
    const type = [
      field.id,
      field.fieldId,
      field.type,
      field.storageId,
      validatorConstructor.name,
    ].join("#");

    const key = createCacheKey(type);
    return this.validatorsCache.getOrSet<IValidator<V>>(key, () => {
      return new validatorConstructor(field);
    });
  }

  private createRegistryGenerator<T extends IGenerator<unknown>>(generator: T) {
    return {
      generate: (field: ApiCmsModelField): ReturnType<T["generate"]> => {
        // @ts-expect-error - type narrowing for generate params
        return generator.generate({
          field,
          getValidator: <V>(validatorConstructor: IValidatorConstructor<V>): IValidator<V> => {
            return this.getValidator(field, validatorConstructor);
          },
        });
      },
    };
  }

  private getNullGenerator(): IRegistryGenerator<IGenerator<unknown>> {
    return {
      generate: async () => null,
    };
  }
}

export const GeneratorRegistry = Abstraction.createImplementation({
  implementation: GeneratorRegistryImpl,
  dependencies: [Logger],
});
