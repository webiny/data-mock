import { createAbstraction } from "@webiny/stdlib";

import type { EnvironmentRef } from "~/shared/types.js";
export interface ILoadTenantsUseCase {
  execute(ref: EnvironmentRef): Promise<void>;
}

export const LoadTenantsUseCase = createAbstraction<ILoadTenantsUseCase>("Ui/LoadTenantsUseCase");

export namespace LoadTenantsUseCase {
  export type Interface = ILoadTenantsUseCase;
}
