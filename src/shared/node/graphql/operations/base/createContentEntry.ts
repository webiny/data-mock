import type { IGraphQLOperation } from "../types.js";
import type { GenericRecord } from "~/shared/types.js";

interface CreateEntryInput {
  singularApiName: string;
  fieldSelection: string;
  variables: GenericRecord;
  skipValidators?: string[];
}

interface CreateEntryOutput {
  data: GenericRecord | null;
  error: { message: string; code: string; data?: GenericRecord | null } | null;
}

export const createContentEntry: IGraphQLOperation<CreateEntryInput, CreateEntryOutput> = {
  name: "createContentEntry",
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
        data: result["data"] as GenericRecord | null,
        error: null,
      },
    };
  },
  getVariables(input) {
    return input.variables;
  },
};

export function buildCreateEntryQuery(input: {
  singularApiName: string;
  fieldSelection: string;
  skipValidators?: string[];
}): string {
  const skipValidatorsArg =
    input.skipValidators && input.skipValidators.length > 0
      ? `, options: { skipValidators: [${input.skipValidators.map((v) => `"${v}"`).join(", ")}] }`
      : "";

  return `
    mutation CreateEntry($data: ${input.singularApiName}Input!) {
      create${input.singularApiName}(data: $data${skipValidatorsArg}) {
        data {
          id
          entryId
          ${input.fieldSelection}
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
