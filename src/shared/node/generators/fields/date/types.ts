import type { IValidator } from "../../types.js";

export interface IValidatorsParams {
  gteValidator: IValidator<string | undefined>;
  lteValidator: IValidator<string | undefined>;
}
