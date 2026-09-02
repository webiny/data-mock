import type { ApiError, IApplication, IBaseApplication } from "~/types.js";
import { logger } from "~/logger.js";
// import { NotFoundError } from "~/errors.js";

export interface ITenant {
  id: string;
  name: string;
}

export const defaultTenant: ITenant = {
  id: "root",
  name: "Root",
};

// const addDefaultTenant = (input: ITenant[]): ITenant[] => {
//     const tenants = [...input];
//     if (!tenants.some(tenant => tenant.id === defaultTenant.id)) {
//         tenants.push(defaultTenant);
//     }
//     return tenants;
// };

export class TenantsApplication implements IApplication {
  private readonly app: IBaseApplication;

  public constructor(app: IBaseApplication) {
    this.app = app;
  }

  public async run(): Promise<void> {
    const tenants = this.app.getStringArg("tenants", "").split(",").filter(Boolean);
    if (tenants.length === 0) {
      throw new Error("No tenants specified.");
    }

    for (const tenant of tenants) {
      logger.debug(`Creating tenant: ${tenant}...`);
      const result = await this.app.graphql.mutation({
        mutation: `
                mutation CreateNewTenant($name: String!) {
                  data: installNamedTenant(name: $name) {
                    data {
                        id
                        name
                    }
                    error {
                        code
                        data
                        stack
                        message
                    }
                  }
                }
                `,
        variables: {
          name: tenant,
        },
        getResult: (json) => {
          const { data: result, extensions = [], errors = [] } = json;
          return {
            data: result?.data?.data || null,
            error: result?.data?.error || (errors[0] as ApiError),
            extensions,
          };
        },
        path: "/graphql",
      });
      if (result.error) {
        if (result.error.code === "TENANT_ALREADY_EXISTS") {
          logger.error(result.error.message);
          return;
        }
        logger.error(result.error.message);
        logger.debug(result.error);
        return;
      }
      logger.debug(`${result.data?.id}...done.`);
    }
  }

  public async listTenants(): Promise<ITenant[]> {
    return [
      {
        id: "root",
        name: "Root",
      },
    ];
    // logger.debug("Listing tenants...");
    // const result = await this.app.graphql.query({
    //     query: `
    //     query ListTenants {
    //         tenancy {
    //             data: listTenants {
    //                 data {
    //                     id
    //                     name
    //                 }
    //                 error {
    //                     message
    //                     code
    //                     data
    //                     stack
    //                 }
    //             }
    //         }
    //     }
    //     `,
    //     getResult: json => {
    //         const { data: result, extensions = [], errors = [] } = json;
    //         const data = result?.tenancy?.data || {};
    //         return {
    //             data: data?.data || null,
    //             error: data?.error || (errors[0] as ApiError),
    //             extensions
    //         };
    //     },
    //     path: "/graphql"
    // });
    //
    // if (result.error) {
    //     logger.error(result.error);
    //     throw new Error(result.error.message);
    // } else if (!result.data?.length) {
    //     throw new NotFoundError("No tenants found.");
    // }
    // return addDefaultTenant(result.data).sort((a, b) => {
    //     return a.id.localeCompare(b.id);
    // });
  }
}
