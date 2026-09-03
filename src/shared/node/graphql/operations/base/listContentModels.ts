import { z } from "zod";
import { defineOperation } from "../defineOperation.js";
import type { ApiCmsModel } from "~/shared/types.js";

const dataSchema = z.array(
  z
    .object({
      name: z.string(),
      modelId: z.string(),
      singularApiName: z.string(),
      pluralApiName: z.string(),
      description: z.string().nullable().optional(),
      group: z.string(),
      tags: z.array(z.string()).optional(),
      fields: z.array(z.unknown()),
    })
    .passthrough(),
);

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

export const listContentModels = defineOperation<void, z.infer<typeof dataSchema>, ApiCmsModel[]>({
  name: "listContentModels",
  path: "/cms/manage",
  responseKey: "listContentModels",
  dataSchema,
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
          group
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
});
