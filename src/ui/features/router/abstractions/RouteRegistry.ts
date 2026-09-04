import { createAbstraction } from "@webiny/stdlib";
import type { Route } from "./Route.js";

export interface IRouteResolveArgs {
  path: string;
}

export interface IRouteResolveResult {
  route: Route.Interface;
  match: Route.Match;
}

export interface IRouteRegistry {
  resolve(args: IRouteResolveArgs): IRouteResolveResult | undefined;
}

export const RouteRegistry = createAbstraction<IRouteRegistry>("Ui/RouteRegistry");

export namespace RouteRegistry {
  export type Interface = IRouteRegistry;
  export type ResolveArgs = IRouteResolveArgs;
  export type ResolveResult = IRouteResolveResult;
}
