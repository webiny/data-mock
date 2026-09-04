import { z } from "zod";
import type { IGraphQLOperation, OperationQuery } from "../types.js";
import type { GenericRecord } from "~/shared/types.js";

const listDataSchema = z.array(z.object({}).passthrough());
const listMetaSchema = z.object({
  totalCount: z.number(),
  hasMoreItems: z.boolean(),
  cursor: z.string().nullable(),
});

interface ListEntriesInput {
  pluralApiName: string;
  fieldSelection: string;
  limit?: number;
  after?: string | null;
}

interface ListEntriesOutput {
  data: GenericRecord[];
  meta: {
    totalCount: number;
    hasMoreItems: boolean;
    cursor: string | null;
  };
}

export const listContentEntries: IGraphQLOperation<ListEntriesInput, ListEntriesOutput> = {
  name: "listContentEntries",
  path: "/cms/manage",
  query: "",
  getResult(json) {
    if (!json.data) {
      const msg =
        json.errors && json.errors.length > 0
          ? ((json.errors[0] as { message?: string }).message ?? "GraphQL error")
          : "Unexpected response: data is null";
      return { data: null, error: { message: msg, code: "GRAPHQL_ERROR" } };
    }
    const key = Object.keys(json.data)[0];
    if (!key) {
      return { data: null, error: { message: "Unexpected response shape", code: "UNKNOWN" } };
    }
    const result = json.data[key] as Record<string, unknown>;
    if (result["error"]) {
      return {
        data: null,
        error: result["error"] as { message: string; code: string; data?: GenericRecord | null },
      };
    }
    const parsedData = listDataSchema.safeParse(result["data"]);
    if (!parsedData.success) {
      return {
        data: null,
        error: {
          message: `Invalid list entries data: ${parsedData.error.issues[0]?.message ?? "unknown"}`,
          code: "VALIDATION",
        },
      };
    }
    const parsedMeta = listMetaSchema.safeParse(result["meta"]);
    if (!parsedMeta.success) {
      return {
        data: null,
        error: {
          message: `Invalid list entries meta: ${parsedMeta.error.issues[0]?.message ?? "unknown"}`,
          code: "VALIDATION",
        },
      };
    }
    return {
      data: {
        data: parsedData.data as GenericRecord[],
        meta: parsedMeta.data,
      },
    };
  },
  getVariables(input) {
    return {
      limit: input.limit ?? 1000,
      after: input.after ?? null,
    };
  },
};

export function buildListEntriesQuery(input: {
  pluralApiName: string;
  fieldSelection: string;
}): OperationQuery<GenericRecord[]> {
  const operationName = `list${input.pluralApiName}`;

  return {
    query: `
    query ListEntries($limit: Int, $after: String) {
      ${operationName}(limit: $limit, after: $after) {
        data {
          id
          entryId
          ${input.fieldSelection}
        }
        meta {
          totalCount
          hasMoreItems
          cursor
        }
        error {
          message
          code
          data
        }
      }
    }
  `,
    responseKey: operationName,
    dataSchema: listDataSchema,
  };
}
