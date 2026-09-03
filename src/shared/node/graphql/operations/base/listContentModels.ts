import { z } from "zod";
import { defineOperation } from "../defineOperation.js";
import type { ApiCmsModel } from "~/shared/types.js";

const predefinedValueSchema = z
  .object({
    label: z.string().nullable(),
    value: z.string().nullable(),
    selected: z.boolean().nullable(),
  })
  .strict();

const predefinedValuesSchema = z
  .object({
    enabled: z.boolean().nullable(),
    values: z.array(predefinedValueSchema).nullable(),
  })
  .strict();

const fieldValidationSchema = z
  .object({
    name: z.string(),
    message: z.string().nullable(),
    settings: z.unknown().optional(),
  })
  .strict();

const fieldSchema = z
  .object({
    id: z.string(),
    fieldId: z.string(),
    storageId: z.string().nullable(),
    type: z.string(),
    list: z.boolean().nullable(),
    settings: z.unknown().optional(),
    predefinedValues: predefinedValuesSchema.nullable(),
    validation: z.array(fieldValidationSchema).nullable(),
    listValidation: z.array(fieldValidationSchema).nullable(),
  })
  .strict();

const modelSchema = z
  .object({
    name: z.string(),
    modelId: z.string(),
    singularApiName: z.string(),
    pluralApiName: z.string(),
    description: z.string().nullable(),
    group: z.string(),
    tags: z.array(z.string()),
    fields: z.array(fieldSchema),
  })
  .strict();

const dataSchema = z.array(modelSchema);

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
