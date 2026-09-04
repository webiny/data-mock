import { createAbstraction } from "@webiny/stdlib";

export interface IBaseUrl {
  readonly value: string;
}

export const BaseUrl = createAbstraction<IBaseUrl>("Ui/BaseUrl");

export namespace BaseUrl {
  export type Interface = IBaseUrl;
}
