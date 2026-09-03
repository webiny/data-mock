import { z } from "zod";
import { defineOperation } from "../defineOperation.js";

const dataSchema = z.array(
  z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
      icon: z.string().nullable(),
    })
    .strict(),
);

interface ContentModelGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
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
