import { z } from "zod";
import { defineOperation } from "../defineOperation.js";

const iconSchema = z
  .object({
    type: z.string(),
    name: z.string(),
    value: z.string().optional(),
  })
  .strict();

const dataSchema = z.array(
  z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
      icon: iconSchema.nullable(),
    })
    .strict(),
);

interface Icon {
  type: string;
  name: string;
  value?: string;
}

interface ContentModelGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: Icon | null;
}

export const listContentModelGroups = defineOperation<
  void,
  z.infer<typeof dataSchema>,
  ContentModelGroup[]
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
