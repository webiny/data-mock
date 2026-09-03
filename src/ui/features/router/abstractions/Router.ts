import { createAbstraction } from "@webiny/stdlib";

export interface IRouter {
  readonly currentView: string;
  readonly params: Record<string, string>;
  navigate(view: string, params?: Record<string, string>): void;
  goBack(): void;
}

export const Router = createAbstraction<IRouter>("Ui/Router");

export namespace Router {
  export type Interface = IRouter;
}
