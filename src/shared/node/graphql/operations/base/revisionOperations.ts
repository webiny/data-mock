import { z } from "zod";
import type { IGraphQLOperation, OperationQuery } from "../types.js";
import type { GenericRecord } from "~/shared/types.js";
import { parseOperationResponse } from "../parseOperationResponse.js";

const revisionDataSchema = z.object({ id: z.string(), entryId: z.string() }).passthrough();
const deleteDataSchema = z.boolean();

interface RevisionOutput {
  data: GenericRecord | null;
  error: { message: string; code: string; data?: GenericRecord | null } | null;
}

function wrapRevisionResult<T>(
  json: Parameters<IGraphQLOperation["getResult"]>[0],
  schema: z.ZodType<T>,
): ReturnType<IGraphQLOperation<void, RevisionOutput>["getResult"]> {
  const result = parseOperationResponse(json, null, schema);
  if (result.error) {
    return result;
  }
  return { data: { data: result.data as GenericRecord | null, error: null } };
}

export const createRevisionOperation: IGraphQLOperation<void, RevisionOutput> = {
  name: "createRevision",
  path: "/cms/manage",
  query: "",
  getResult(json) {
    return wrapRevisionResult(json, revisionDataSchema);
  },
};

export const publishEntryOperation: IGraphQLOperation<void, RevisionOutput> = {
  name: "publishEntry",
  path: "/cms/manage",
  query: "",
  getResult(json) {
    return wrapRevisionResult(json, revisionDataSchema);
  },
};

export const unpublishEntryOperation: IGraphQLOperation<void, RevisionOutput> = {
  name: "unpublishEntry",
  path: "/cms/manage",
  query: "",
  getResult(json) {
    return wrapRevisionResult(json, revisionDataSchema);
  },
};

export const deleteEntryOperation: IGraphQLOperation<void, RevisionOutput> = {
  name: "deleteEntry",
  path: "/cms/manage",
  query: "",
  getResult(json) {
    return wrapRevisionResult(json, deleteDataSchema);
  },
};

export function buildCreateRevisionQuery(input: {
  singularApiName: string;
  fieldSelection: string;
}): OperationQuery<z.infer<typeof revisionDataSchema>> {
  const operationName = `create${input.singularApiName}From`;

  return {
    query: `
    mutation CreateRevision($revision: ID!, $data: ${input.singularApiName}Input!) {
      ${operationName}(revision: $revision, data: $data) {
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
    dataSchema: revisionDataSchema,
  };
}

export function buildPublishQuery(
  singularApiName: string,
): OperationQuery<z.infer<typeof revisionDataSchema>> {
  const operationName = `publish${singularApiName}`;

  return {
    query: `
    mutation PublishEntry($revision: ID!) {
      ${operationName}(revision: $revision) {
        data {
          id
          entryId
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
    dataSchema: revisionDataSchema,
  };
}

export function buildUnpublishQuery(
  singularApiName: string,
): OperationQuery<z.infer<typeof revisionDataSchema>> {
  const operationName = `unpublish${singularApiName}`;

  return {
    query: `
    mutation UnpublishEntry($revision: ID!) {
      ${operationName}(revision: $revision) {
        data {
          id
          entryId
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
    dataSchema: revisionDataSchema,
  };
}

export function buildDeleteEntryQuery(
  singularApiName: string,
): OperationQuery<z.infer<typeof deleteDataSchema>> {
  const operationName = `delete${singularApiName}`;

  return {
    query: `
    mutation DeleteEntry($revision: ID!) {
      ${operationName}(revision: $revision) {
        data
        error {
          message
          code
          data
        }
      }
    }
  `,
    responseKey: operationName,
    dataSchema: deleteDataSchema,
  };
}
