import type { ZodType } from "zod";
import type { ApiGraphQLResult, ApiGraphQLResultJson } from "../abstractions/GraphQLClient.js";

export function parseOperationResponse<TData, TOutput = TData>(
  json: ApiGraphQLResultJson,
  responseKey: string | null,
  dataSchema: ZodType<TData>,
  transform?: (data: TData) => TOutput,
): ApiGraphQLResult<TOutput> {
  if (!json.data) {
    // "as": parsing boundary — json is the untyped GraphQL network response.
    const message =
      json.errors && json.errors.length > 0
        ? ((json.errors[0] as { message?: string }).message ?? "GraphQL error")
        : "Unexpected response: data is null";
    return { data: null, error: { message, code: "GRAPHQL_ERROR" } };
  }

  const key = responseKey ?? Object.keys(json.data)[0];
  if (!key) {
    return { data: null, error: { message: "Unexpected response shape", code: "UNKNOWN" } };
  }

  // "as": parsing boundary — json is the untyped GraphQL network response.
  const result = json.data[key] as Record<string, unknown> | undefined;
  if (!result) {
    return { data: null, error: { message: "Unexpected response shape", code: "UNKNOWN" } };
  }

  if (result["error"]) {
    return {
      data: null,
      // "as": parsing boundary — json is the untyped GraphQL network response.
      error: result["error"] as {
        message: string;
        code: string;
        data?: Record<string, unknown> | null;
      },
    };
  }

  const parsed = dataSchema.safeParse(result["data"]);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        message: `Invalid ${key} response: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        code: "VALIDATION",
      },
    };
  }

  // "as": generic boundary — without a transform, TData and TOutput are asserted equal by the caller's own type parameters.
  const output = transform ? transform(parsed.data) : (parsed.data as unknown as TOutput);
  return { data: output };
}
