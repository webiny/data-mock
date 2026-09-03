import { createAbstraction } from "@webiny/stdlib";

export interface ILoadTenantsUseCase {
  execute(projectId: string): Promise<void>;
}

export const LoadTenantsUseCase = createAbstraction<ILoadTenantsUseCase>("Ui/LoadTenantsUseCase");

export namespace LoadTenantsUseCase {
  export type Interface = ILoadTenantsUseCase;
}
