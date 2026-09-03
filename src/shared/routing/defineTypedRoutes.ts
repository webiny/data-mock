import { z } from "zod";
import type { HTTPMethod, ExtractParams } from "./defineRoute.js";

type ParamValue = string | number;

type ExactParamKeys<TPath extends string> = {
  [K in ExtractParams<TPath>]: ParamValue;
};

export type ResponseType = "list" | "one" | "none";

export interface TypedRouteDefinition<
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
  responseType: ResponseType;
  responseKey?: string | undefined;
}

interface ListRouteConfig<TPath extends string, TParams, TQuerystring, TItem> {
  method?: HTTPMethod;
  path: TPath;
  description?: string;
  params: z.ZodType<TParams>;
  querystring?: z.ZodType<TQuerystring>;
  item: z.ZodType<TItem>;
}

interface OneRouteConfig<TPath extends string, TParams, TBody, TQuerystring, TItem> {
  method?: HTTPMethod;
  path: TPath;
  description?: string;
  params: z.ZodType<TParams>;
  body?: z.ZodType<TBody>;
  querystring?: z.ZodType<TQuerystring>;
  item: z.ZodType<TItem>;
}

interface VoidRouteConfig<TPath extends string, TParams, TBody> {
  method?: HTTPMethod;
  path: TPath;
  description?: string;
  params: z.ZodType<TParams>;
  body?: z.ZodType<TBody>;
}

export function defineListRoute<
  TKey extends string,
  TPath extends string,
  TParams extends ExactParamKeys<TPath>,
  TQuerystring = never,
  TItem = unknown,
>(
  key: TKey,
  config: ListRouteConfig<TPath, TParams, TQuerystring, TItem>,
): TypedRouteDefinition<
  TPath,
  TParams,
  never,
  Record<TKey, { items: TItem[]; total: number }>,
  HTTPMethod,
  TQuerystring
> {
  const listEnvelope = z.object({
    items: z.array(config.item),
    total: z.number(),
  });

  type ListResponse = Record<TKey, { items: TItem[]; total: number }>;

  const response = z.object({ [key]: listEnvelope });

  return {
    description: config.description ?? `List ${key}`,
    method: config.method ?? "GET",
    path: config.path,
    params: config.params,
    querystring: config.querystring,
    response: response as unknown as z.ZodType<ListResponse>,
    responseType: "list",
    responseKey: key,
  };
}

export function defineOneRoute<
  TKey extends string,
  TPath extends string,
  TParams extends ExactParamKeys<TPath>,
  TBody = never,
  TQuerystring = never,
  TItem = unknown,
>(
  key: TKey,
  config: OneRouteConfig<TPath, TParams, TBody, TQuerystring, TItem>,
): TypedRouteDefinition<TPath, TParams, TBody, Record<TKey, TItem>, HTTPMethod, TQuerystring> {
  const response = z.object({ [key]: config.item });

  return {
    description: config.description ?? `Get ${key}`,
    method: config.method ?? "GET",
    path: config.path,
    params: config.params,
    body: config.body,
    querystring: config.querystring,
    response,
    responseType: "one",
    responseKey: key,
  };
}

export function defineVoidRoute<
  TPath extends string,
  TParams extends ExactParamKeys<TPath>,
  TBody = never,
>(
  config: VoidRouteConfig<TPath, TParams, TBody>,
): TypedRouteDefinition<TPath, TParams, TBody, void, HTTPMethod, never> {
  return {
    description: config.description ?? "Action",
    method: config.method ?? "DELETE",
    path: config.path,
    params: config.params,
    body: config.body,
    responseType: "none",
  };
}
