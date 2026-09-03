import { z } from "zod";
import { defineOperation } from "../defineOperation.js";

export const predefinedValueSchema = z
  .object({
    label: z.string().nullable(),
    value: z.string().nullable(),
    selected: z.boolean().nullable(),
  })
  .strict();

export const predefinedValuesSchema = z
  .object({
    enabled: z.boolean().nullable(),
    values: z.array(predefinedValueSchema).nullable(),
  })
  .strict();

export const fieldValidationSchema = z
  .object({
    name: z.string(),
    message: z.string().nullable(),
    settings: z.record(z.string(), z.any()).nullable(),
  })
  .strict();

export const contentModelFieldSchema = z
  .object({
    id: z.string(),
    fieldId: z.string(),
    storageId: z.string().nullable(),
    type: z.string(),
    list: z.boolean().nullable(),
    settings: z.record(z.string(), z.any()).nullable(),
    predefinedValues: predefinedValuesSchema.nullable(),
    validation: z.array(fieldValidationSchema).nullable(),
    listValidation: z.array(fieldValidationSchema).nullable(),
  })
  .strict();

export const contentModelSchema = z
  .object({
    name: z.string(),
    modelId: z.string(),
    singularApiName: z.string(),
    pluralApiName: z.string(),
    description: z.string().nullable(),
    group: z.string(),
    tags: z.array(z.string()),
    fields: z.array(contentModelFieldSchema),
  })
  .strict();

const dataSchema = z.array(contentModelSchema);

export type CmsContentModelField = z.infer<typeof contentModelFieldSchema>;
export type CmsContentModel = z.infer<typeof contentModelSchema>;
export type CmsFieldValidation = z.infer<typeof fieldValidationSchema>;
export type CmsPredefinedValues = z.infer<typeof predefinedValuesSchema>;

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

export const listContentModels = defineOperation<
  void,
  z.infer<typeof dataSchema>,
  CmsContentModel[]
>({
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
