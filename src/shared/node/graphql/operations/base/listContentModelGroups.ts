import { z } from "zod";
import { defineOperation } from "../defineOperation.js";

export const iconSchema = z
  .object({
    type: z.string(),
    name: z.string(),
    value: z.string().optional(),
  })
  .strict();

export const contentModelGroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    icon: iconSchema.nullable(),
  })
  .strict();

const dataSchema = z.array(contentModelGroupSchema);

export type CmsIcon = z.infer<typeof iconSchema>;
export type CmsContentModelGroup = z.infer<typeof contentModelGroupSchema>;

export const listContentModelGroups = defineOperation<
  void,
  z.infer<typeof dataSchema>,
  CmsContentModelGroup[]
>({
  name: "listContentModelGroups",
  path: "/cms/manage",
  responseKey: "listContentModelGroups",
  dataSchema,
  query: `
    query ListContentModelGroups {
      listContentModelGroups {
        data {
          id
          name
          slug
          description
          icon
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
