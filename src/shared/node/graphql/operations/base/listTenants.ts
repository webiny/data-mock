import { z } from "zod";
import { defineOperation } from "../defineOperation.js";

/**
 * Tenants are entries of the `wbyTenant` CMS model. `id` is the entry's revision id
 * (`6ab6…#0001`); the tenant id — what `x-tenant` must carry — is `entryId`. Sending the revision
 * id as `x-tenant` answers every request with a 500.
 */
export const tenantSchema = z
  .object({
    id: z.string(),
    entryId: z.string(),
    values: z.object({ name: z.string() }).strict(),
  })
  .strict();

const dataSchema = z.array(tenantSchema);

export type CmsTenant = z.infer<typeof tenantSchema>;

export interface Tenant {
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
          entryId
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
  transform: (data) => data.map((tenant) => ({ id: tenant.entryId, name: tenant.values.name })),
});
