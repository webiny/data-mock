import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IArchiveProjectUseCase {
  execute(id: string): Promise<Result<void, HTTPError>>;
}

export const ArchiveProjectUseCase = createAbstraction<IArchiveProjectUseCase>(
  "Ui/ArchiveProjectUseCase",
);

export namespace ArchiveProjectUseCase {
  export type Interface = IArchiveProjectUseCase;
}
