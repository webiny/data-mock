import type { z } from "zod";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ParamValue = string | number;

export type ExtractParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ExtractParams<Rest>
  : T extends `${string}:${infer Param}`
    ? Param
    : never;

type ExactParamKeys<TPath extends string> = {
  [K in ExtractParams<TPath>]: ParamValue;
};

export interface RouteDefinition<
  TPath extends string = string,
  TParams = unknown,
  TBody = never,
  TResponse = void,
  TMethod extends HTTPMethod = HTTPMethod,
  TQuerystring = never,
> {
  description: string;
  method: TMethod;
  path: TPath;
  params: z.ZodType<TParams>;
  body?: z.ZodType<TBody> | undefined;
  response?: z.ZodType<TResponse> | undefined;
  querystring?: z.ZodType<TQuerystring> | undefined;
}

interface RouteConfig<
  TPath extends string,
  TMethod extends HTTPMethod,
  TParams extends ExactParamKeys<TPath>,
  TBody,
  TResponse,
  TQuerystring,
> {
  description: string;
  method: TMethod;
  path: TPath;
  params: ExactParamKeys<TPath> extends Record<keyof TParams, ParamValue>
    ? z.ZodType<TParams>
    : never;
  body?: z.ZodType<TBody>;
  response?: z.ZodType<TResponse>;
  querystring?: z.ZodType<TQuerystring>;
}

export function defineRoute<
  TPath extends string,
  TMethod extends HTTPMethod,
  TParams extends ExactParamKeys<TPath>,
  TBody = never,
  TResponse = void,
  TQuerystring = never,
>(
  config: RouteConfig<TPath, TMethod, TParams, TBody, TResponse, TQuerystring>,
): RouteDefinition<TPath, TParams, TBody, TResponse, TMethod, TQuerystring> {
  return config;
}
