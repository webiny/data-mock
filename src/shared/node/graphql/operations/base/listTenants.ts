import type { IGraphQLOperation } from "../types.js";

interface Tenant {
  id: string;
  name: string;
}

export const listTenants: IGraphQLOperation<void, Tenant[]> = {
  name: "listTenants",
  path: "/graphql",
  query: `
    query ListTenants {
      tenancy {
        listTenants {
          data {
            id
            name
          }
          error {
            message
            code
            data
          }
        }
      }
    }
  `,
  getResult(json) {
    const tenancy = json.data["tenancy"] as Record<string, unknown> | undefined;
    if (!tenancy) {
      return { data: null, error: { message: "Unexpected response shape", code: "UNKNOWN" } };
    }
    const result = tenancy["listTenants"] as Record<string, unknown> | undefined;
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
    return { data: result["data"] as Tenant[] };
  },
};
