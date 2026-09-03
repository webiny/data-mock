import type { IGraphQLOperation } from "../types.js";
import type { GenericRecord } from "~/shared/types.js";

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
    const keys = Object.keys(json.data);
    const operationKey = keys[0];
    if (!operationKey) {
      return { data: null, error: { message: "Unexpected response shape", code: "UNKNOWN" } };
    }
    const result = json.data[operationKey] as Record<string, unknown>;
    if (result["error"]) {
      return {
        data: null,
        error: result["error"] as { message: string; code: string; data?: GenericRecord | null },
      };
    }
    return {
      data: {
        data: result["data"] as GenericRecord[],
        meta: result["meta"] as ListEntriesOutput["meta"],
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
}): string {
  return `
    query ListEntries($limit: Int, $after: String) {
      list${input.pluralApiName}(limit: $limit, after: $after) {
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
  `;
}
