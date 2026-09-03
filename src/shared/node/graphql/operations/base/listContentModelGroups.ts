import type { IGraphQLOperation } from "../types.js";

interface ContentModelGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

export const listContentModelGroups: IGraphQLOperation<void, ContentModelGroup[]> = {
  name: "listContentModelGroups",
  path: "/cms/manage",
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
  getResult(json) {
    const result = json.data["listContentModelGroups"] as Record<string, unknown> | undefined;
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
    return { data: result["data"] as ContentModelGroup[] };
  },
};
