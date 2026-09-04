import { z } from "zod";
import type { IGraphQLOperation, OperationQuery } from "../types.js";
import type { GenericRecord } from "~/shared/types.js";
import { parseOperationResponse } from "../parseOperationResponse.js";

const entryDataSchema = z.object({ id: z.string(), entryId: z.string() }).passthrough();

interface CreateEntryInput {
  singularApiName: string;
  fieldSelection: string;
  variables: GenericRecord;
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
    const result = parseOperationResponse(json, null, entryDataSchema);
    if (result.error) {
      return result;
    }
    return { data: { data: result.data as GenericRecord, error: null } };
  },
  getVariables(input) {
    return input.variables;
  },
};

export function buildCreateEntryQuery(input: {
  singularApiName: string;
  fieldSelection: string;
}): OperationQuery<z.infer<typeof entryDataSchema>> {
  const operationName = `create${input.singularApiName}`;

  return {
    query: `
    mutation CreateEntry($data: ${input.singularApiName}Input!) {
      ${operationName}(data: $data) {
        data {
          id
          entryId
          values {
            ${input.fieldSelection}
          }
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
    dataSchema: entryDataSchema,
  };
}
