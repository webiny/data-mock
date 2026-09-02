import type { ApiCmsModelField } from "~/types.js";
import type { IGenerator, IRegistryGenerator } from "./types.js";
import { registry } from "./registry.js";

import "./fields/index.js";
import "./validators/index.js";

export interface IGetGeneratorParams {
  field: ApiCmsModelField;
}

export const getGenerator = <T extends IGenerator<unknown>>({
  field,
}: IGetGeneratorParams): IRegistryGenerator<T> => {
  return registry.getGenerator<T>({
    field,
  });
};
