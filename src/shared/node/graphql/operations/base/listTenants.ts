import { z } from "zod";
import { defineOperation } from "../defineOperation.js";

const tenantValuesSchema = z
  .object({
    name: z.string(),
    isInstalled: z.boolean().optional(),
    status: z.string().optional(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

const dataSchema = z.array(
  z
    .object({
      id: z.string(),
      entryId: z.string().optional(),
      values: tenantValuesSchema,
    })
    .passthrough(),
);

interface Tenant {
  id: string;
  name: string;
}

export const listTenants = defineOperation<void, z.infer<typeof dataSchema>, Tenant[]>({
  name: "listTenants",
  path: "/cms/manage",
  responseKey: "listTenants",
  dataSchema,
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
  transform: (data) => data.map((e) => ({ id: e.id, name: e.values.name })),
});
