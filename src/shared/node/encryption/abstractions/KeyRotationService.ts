import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IKeyRotationInput {
  oldKey: string;
  newKey: string;
}

export interface IKeyRotationOutput {
  rotated: number;
}

export interface IKeyRotationService {
  execute(
    input: KeyRotationService.Input,
  ): Promise<Result<KeyRotationService.Output, KeyRotationService.Error>>;
}

export const KeyRotationService = createAbstraction<IKeyRotationService>(
  "Encryption/KeyRotationService",
);

export namespace KeyRotationService {
  export type Interface = IKeyRotationService;
  export type Input = IKeyRotationInput;
  export type Output = IKeyRotationOutput;
  export type Error = ProjectPersistenceError;
}
