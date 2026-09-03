import { z } from "zod";
import type { IGraphQLOperation } from "../types.js";

const dataSchema = z.array(
  z.object({ id: z.string(), values: z.object({ name: z.string() }).passthrough() }).passthrough(),
);

interface Tenant {
  id: string;
  name: string;
}

export const listTenants: IGraphQLOperation<void, Tenant[]> = {
  name: "listTenants",
  path: "/cms/manage",
  query: `
    query ListTenants {
      listTenants {
        data {
          id
          values {
            name
          }
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
    const result = json.data["listTenants"] as Record<string, unknown> | undefined;
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
          message: `Invalid listTenants response: ${parsed.error.issues[0]?.message ?? "unknown"}`,
          code: "VALIDATION",
        },
      };
    }
    return {
      data: parsed.data.map((e) => ({ id: e.id, name: e.values.name })),
    };
  },
};
