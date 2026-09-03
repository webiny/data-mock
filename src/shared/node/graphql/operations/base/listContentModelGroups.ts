import { z } from "zod";
import type { IGraphQLOperation } from "../types.js";

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
    const parsed = dataSchema.safeParse(result["data"]);
    if (!parsed.success) {
      return {
        data: null,
        error: {
          message: `Invalid listContentModelGroups response: ${parsed.error.issues[0]?.message ?? "unknown"}`,
          code: "VALIDATION",
        },
      };
    }
    return { data: parsed.data as unknown as ContentModelGroup[] };
  },
};
