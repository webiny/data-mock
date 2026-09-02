import type { ApiCmsGroup, IBaseApplication, IGroupApplication } from "~/types.js";
import { logger } from "~/logger.js";
import { createGetCmsContentResult } from "./cms/createGetCmsContentResult.js";
import { createBlog, createCars } from "./cms/index.js";
import type { CmsGroup } from "./cms/types.js";

export class GroupApplication implements IGroupApplication {
  private readonly app: IBaseApplication;
  public readonly groups: ApiCmsGroup[] = [];
  public constructor(app: IBaseApplication) {
    this.app = app;
  }

  public getGroups(): ApiCmsGroup[] {
    return this.groups;
  }

  public async run(): Promise<void> {
    const groups = [createBlog(), createCars()];

    logger.info("Listing groups to check if any already exist.");
    const { data: listedData, error: listedError } = await this.list();

    if (listedError) {
      logger.error(listedError);
      return;
    }

    for (const group of groups) {
      logger.info(`Checking for the group "${group.name}".`);
      const exists = listedData.find((g) => g.slug.toLowerCase() === group.slug.toLowerCase());
      if (exists) {
        logger.info("Group already exists, skipping...");
        this.groups.push(exists);
        continue;
      }
      logger.info(`Creating group "${group.name}"...`);
      const { data, error } = await this.create(group);
      if (error) {
        logger.error(error);
        continue;
      } else if (!data) {
        logger.error(`No data received after created the group: ${group.name}`);
        continue;
      }
      logger.info("...group created.");
      this.groups.push(data);
    }
  }

  private async list() {
    const query = `
            query {
                data: listContentModelGroups {
                    data {
                        id
                        name
                        slug
                    }
                    error {
                        message
                        code
                        data
                    }
                }
            }
        `;
    return await this.app.graphql.query<ApiCmsGroup[]>({
      query,
      path: "/cms/manage",
      getResult: createGetCmsContentResult(),
    });
  }

  private async create(group: CmsGroup) {
    const mutation = `
            mutation CreateGroupMutation($data: CmsContentModelGroupInput!) {
                data: createContentModelGroup(data: $data) {
                    data {
                        id
                        name
                        slug
                    }
                    error {
                        message
                        code
                        data
                    }
                }
            }
        `;
    const variables = {
      data: {
        name: group.name,
        slug: group.slug,
        icon: "fa/fas",
      },
    };
    return await this.app.graphql.mutation<ApiCmsGroup>({
      mutation,
      path: "/cms/manage",
      variables,
      getResult: createGetCmsContentResult(),
    });
  }
}
