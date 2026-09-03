import { z } from "zod";
import { defineOperation } from "../defineOperation.js";

const dataSchema = z.array(
  z.object({ id: z.string(), name: z.string(), slug: z.string() }).passthrough(),
);

interface ContentModelGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
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
