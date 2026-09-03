import { z } from "zod";
import { defineOperation } from "../defineOperation.js";
import type { ApiCmsModel } from "~/shared/types.js";

const predefinedValueSchema = z
  .object({
    label: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
    selected: z.boolean().nullable().optional(),
  })
  .passthrough();

const predefinedValuesSchema = z
  .object({
    enabled: z.boolean().nullable().optional(),
    values: z.array(predefinedValueSchema).nullable().optional(),
  })
  .passthrough();

const fieldValidationSchema = z
  .object({
    name: z.string(),
    message: z.string().nullable().optional(),
    settings: z.unknown().optional(),
  })
  .passthrough();

const fieldSchema = z
  .object({
    id: z.string(),
    fieldId: z.string(),
    storageId: z.string().nullable().optional(),
    type: z.string(),
    list: z.boolean().nullable().optional(),
    settings: z.unknown().optional(),
    predefinedValues: predefinedValuesSchema.nullable().optional(),
    validation: z.array(fieldValidationSchema).nullable().optional(),
    listValidation: z.array(fieldValidationSchema).nullable().optional(),
  })
  .passthrough();

const modelSchema = z
  .object({
    name: z.string(),
    modelId: z.string(),
    singularApiName: z.string(),
    pluralApiName: z.string(),
    description: z.string().nullable().optional(),
    group: z.string(),
    tags: z.array(z.string()).optional(),
    fields: z.array(fieldSchema),
  })
  .passthrough();

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
