import type { IGraphQLOperation } from "../types.js";
import type { GenericRecord } from "~/shared/types.js";
import type { ApiGraphQLResult, ApiGraphQLResultJson } from "../../abstractions/GraphQLClient.js";

interface RevisionOutput {
  data: GenericRecord | null;
  error: { message: string; code: string; data?: GenericRecord | null } | null;
}

function getResultFromFirstKey(json: ApiGraphQLResultJson): ApiGraphQLResult<RevisionOutput> {
  const keys = Object.keys(json.data);
  const operationKey = keys[0];
  if (!operationKey) {
    return { error: { message: "Unexpected response shape", code: "UNKNOWN" } };
  }
  const result = json.data[operationKey] as Record<string, unknown>;
  if (result["error"]) {
    return {
      error: result["error"] as { message: string; code: string; data?: GenericRecord | null },
    };
  }
  return {
    data: {
      data: result["data"] as GenericRecord | null,
      error: null,
    },
  };
}

export const createRevisionOperation: IGraphQLOperation<void, RevisionOutput> = {
  name: "createRevision",
  path: "/cms/manage",
  query: "",
  getResult: getResultFromFirstKey,
};

export const publishEntryOperation: IGraphQLOperation<void, RevisionOutput> = {
  name: "publishEntry",
  path: "/cms/manage",
  query: "",
  getResult: getResultFromFirstKey,
};

export const unpublishEntryOperation: IGraphQLOperation<void, RevisionOutput> = {
  name: "unpublishEntry",
  path: "/cms/manage",
  query: "",
  getResult: getResultFromFirstKey,
};

export function buildCreateRevisionQuery(input: {
  singularApiName: string;
  fieldSelection: string;
}): string {
  return `
    mutation CreateRevision($revision: ID!, $data: ${input.singularApiName}Input!) {
      create${input.singularApiName}From(revision: $revision, data: $data) {
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

export function buildPublishQuery(singularApiName: string): string {
  return `
    mutation PublishEntry($revision: ID!) {
      publish${singularApiName}(revision: $revision) {
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
  `;
}

export function buildUnpublishQuery(singularApiName: string): string {
  return `
    mutation UnpublishEntry($revision: ID!) {
      unpublish${singularApiName}(revision: $revision) {
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
  `;
}

export const deleteEntryOperation: IGraphQLOperation<void, RevisionOutput> = {
  name: "deleteEntry",
  path: "/cms/manage",
  query: "",
  getResult: getResultFromFirstKey,
};

export function buildDeleteEntryQuery(singularApiName: string): string {
  return `
    mutation DeleteEntry($revision: ID!) {
      delete${singularApiName}(revision: $revision) {
        data
        error {
          message
          code
          data
        }
      }
    }
  `;
}
