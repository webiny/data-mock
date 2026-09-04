import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { GraphQLRequestError } from "~/shared/errors.js";

export interface IVerifyProjectAccessInput {
  apiUrl: string;
  apiToken: string;
  tenant: string;
}

export interface IVerifyProjectAccessService {
  execute(
    input: VerifyProjectAccessService.Input,
  ): Promise<Result<void, VerifyProjectAccessService.Error>>;
}

export const VerifyProjectAccessService = createAbstraction<IVerifyProjectAccessService>(
  "Tenants/VerifyProjectAccessService",
);

export namespace VerifyProjectAccessService {
  export type Interface = IVerifyProjectAccessService;
  export type Input = IVerifyProjectAccessInput;
  export type Error = GraphQLRequestError;
}
