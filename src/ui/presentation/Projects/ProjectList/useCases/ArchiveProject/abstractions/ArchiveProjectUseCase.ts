import { createAbstraction } from "@webiny/stdlib";

export interface IArchiveProjectUseCase {
  execute(id: string): Promise<void>;
}

export const ArchiveProjectUseCase = createAbstraction<IArchiveProjectUseCase>(
  "Ui/ArchiveProjectUseCase",
);

export namespace ArchiveProjectUseCase {
  export type Interface = IArchiveProjectUseCase;
}
