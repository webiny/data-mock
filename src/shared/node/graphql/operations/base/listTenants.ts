import type { IGraphQLOperation } from "../types.js";

interface Tenant {
  id: string;
  name: string;
}

interface WbyTenantEntry {
  entryId: string;
  name: string;
}

export const listTenants: IGraphQLOperation<void, Tenant[]> = {
  name: "listTenants",
  path: "/cms/manage",
  query: `
    query ListWbyTenants {
      listWbyTenants {
        data {
          entryId
          name
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
    const result = json.data["listWbyTenants"] as Record<string, unknown> | undefined;
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
    const entries = result["data"] as WbyTenantEntry[];
    return {
      data: entries.map((e) => ({ id: e.entryId, name: e.name })),
    };
  },
};
