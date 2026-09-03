import type React from "react";
import { createAbstraction } from "@webiny/stdlib";

export interface IRouteMatch {
  params: Record<string, string>;
}

export interface IRoute {
  readonly name: string;
  readonly path: string | RegExp;
  readonly layout: "full" | "contained";
  matchPath(pathname: string): Record<string, string> | null;
  render(match: IRouteMatch): React.ReactNode;
}

export const Route = createAbstraction<IRoute>("Ui/Route");

export namespace Route {
  export type Interface = IRoute;
  export type Match = IRouteMatch;
}
