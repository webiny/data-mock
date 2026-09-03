import type { ApiCmsModelField, GenericRecord } from "~/shared/types.js";
import type { Logger } from "@webiny/stdlib";

export interface IRegistryGetGeneratorParams {
  field: ApiCmsModelField;
}

export interface IRegistryRegisterGeneratorConstructorParams {
  logger: Logger.Interface;
  getGenerator<T extends IGenerator<unknown>>(type: {
    new (params: IRegistryRegisterGeneratorConstructorParams): T;
  }): IRegistryGenerator<T>;
  getGeneratorByField<T extends IGenerator<unknown>>(
    field: ApiCmsModelField,
  ): IFieldRegistryGenerator<T>;
}

export interface IRegistryRegisterGeneratorConstructor {
  new (params: IRegistryRegisterGeneratorConstructorParams): IGenerator<unknown>;
}

export interface IGeneratorRegistry {
  registerGenerator(generator: IRegistryRegisterGeneratorConstructor): void;
  getGenerator<T extends IGenerator<unknown>>(
    params: IRegistryGetGeneratorParams,
  ): IRegistryGenerator<T>;
  registerValidator(validator: IValidatorConstructor<unknown>): void;
}

export interface IGetValidator {
  <T>(type: { new (field: ApiCmsModelField): IValidator<T> }): IValidator<T>;
}

export interface IGeneratorGenerateParams<T extends ApiCmsModelField = ApiCmsModelField> {
  field: T;
  getValidator: IGetValidator;
}
export interface IGenerator<T> {
  type: string;
  list: boolean;
  generate(params: IGeneratorGenerateParams): Promise<T>;
}

export interface IRegistryGenerator<T extends IGenerator<unknown>> {
  generate(field: ApiCmsModelField): ReturnType<T["generate"]>;
}

export interface IFieldRegistryGenerator<T extends IGenerator<unknown>> {
  generate(): ReturnType<T["generate"]>;
}

export interface IValidatorConstructor<T> {
  new (field: ApiCmsModelField): IValidator<T>;
}

export interface IValidation<T = GenericRecord> {
  name: string;
  message: string;
  settings?: T;
}

export interface IValidator<T> {
  field: ApiCmsModelField;
  getValue(def?: T): T;
  getListValue(def?: T): T;
  getValidation<S>(name: string): IValidation<S> | null;
  getListValidation<S>(name: string): IValidation<S> | null;
}
