import type { IGraphQLOperation } from "../../types.js";
import type { ApiCmsModel } from "~/shared/types.js";

const CMS_MODEL_FIELDS_SUBSELECTION = `
  fields {
    id
    fieldId
    storageId
    type
    list
    settings
    predefinedValues {
      enabled
      values {
        label
        value
        selected
      }
    }
    validation {
      name
      message
      settings
    }
    listValidation {
      name
      message
      settings
    }
  }
`;

export const listContentModels: IGraphQLOperation<void, ApiCmsModel[]> = {
  name: "listContentModels",
  path: "/cms/manage",
  query: `
    query ListContentModels {
      listContentModels {
        data {
          name
          modelId
          singularApiName
          pluralApiName
          tags
          description
          group {
            id
            name
          }
          ${CMS_MODEL_FIELDS_SUBSELECTION}
        }
        error {
          message
          code
          data
        }
      }
    }
  `,
  getResult(json) {
    const result = json.data["listContentModels"] as Record<string, unknown> | undefined;
    if (!result) {
      return { data: null, error: { message: "Unexpected response shape", code: "UNKNOWN" } };
    }
    if (result["error"]) {
      return {
        data: null,
        error: result["error"] as {
          message: string;
          code: string;
          data?: Record<string, unknown> | null;
        },
      };
    }
    return { data: result["data"] as ApiCmsModel[] };
  },
};
