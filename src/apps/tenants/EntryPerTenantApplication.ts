import type { GenericRecord, IApplication, IBaseApplication } from "~/types.js";
import { defaultTenant } from "./TenantsApplication.js";
import type { TenantsApplication } from "./TenantsApplication.js";
import type { ModelApplication } from "~/apps/ModelApplication.js";
import type { EntryApplication } from "~/apps/EntryApplication.js";
import { createEntryVariables } from "~/apps/tenants/helpers/createEntryVariables.js";
import { logger } from "~/logger.js";
import { createCacheKey } from "~/cache/index.js";
import { NotFoundError } from "~/errors/index.js";
import { writeJsonFileSync } from "write-json-file";
import path from "path";

type IStorageCollection = GenericRecord<string, GenericRecord<string, GenericRecord[]>>;

interface IStoreParams {
  collection: IStorageCollection;
  path: string;
  perTenant: number;
  tenants: string[];
  models: string[];
}

export class EntryPerTenantApplication implements IApplication {
  private readonly app: IBaseApplication;

  public constructor(app: IBaseApplication) {
    this.app = app;
  }

  public async run(): Promise<void> {
    try {
      await this.execute();
    } finally {
      this.app.cache.enable();
    }
  }

  private async execute(): Promise<void> {
    this.app.graphql.setTenant("root");

    const collection: IStorageCollection = {};

    const perTenant = this.app.getNumberArg("amount", 5);
    const tenantsInput = this.app.getStringArg("tenants", "").split(",").filter(Boolean);
    const startFromTenant = this.app.getStringArg("startFromTenant", "").toLowerCase();
    const modelsInput = this.app.getStringArg("models", "").split(",").filter(Boolean);
    const dryRun = this.app.getBooleanArg("dryRun", false);
    const dryRunPath = this.app.getStringArg("dryRunPath", "./dryRuns");
    if (dryRun && !dryRunPath) {
      throw new Error(
        "Missing dryRunPath. It must be set when dryRun is enabled, as it will store the data in that directory.",
      );
    }

    const useCache = this.app.getBooleanArg("cache", true);
    if (useCache === false) {
      this.app.cache.disable();
    }

    if (perTenant <= 0) {
      throw new Error("Amount must be greater than 0.");
    }

    if (!modelsInput?.length) {
      throw new Error("No models specified.");
    }

    if (!tenantsInput?.length) {
      throw new Error("No tenants specified.");
    }

    const entryApp = this.app.getApp<EntryApplication>("entry");

    let tenants = await this.app.cache.getOrSet(
      createCacheKey({
        app: "entryPerTenant",
        key: "tenants",
      }),
      async () => {
        try {
          return await this.app.getApp<TenantsApplication>("tenants").listTenants();
        } catch (ex) {
          if (ex instanceof NotFoundError) {
            return [defaultTenant];
          }
          throw ex;
        }
      },
    );
    if (startFromTenant) {
      const startingTenant = tenants.findIndex(
        (tenant) => tenant.name.toLowerCase() === startFromTenant,
      );
      if (startingTenant !== -1) {
        tenants = tenants.slice(startingTenant);
      }
    }
    if (tenantsInput[0] !== "*") {
      tenants = tenants.filter((tenant) => {
        const id = tenant.id.toLowerCase();
        const name = tenant.name.toLowerCase();
        return tenantsInput.some((tenantInput) => {
          const tenantInputName = tenantInput.toLowerCase();
          return tenantInputName === name || tenantInputName === id;
        });
      });
    }
    if (tenants.length === 0) {
      logger.info(`No tenants matched to the input.`);
      this.app.cache.clear();
      return;
    }
    logger.info(`Running through ${tenants.length} tenants.`);

    for (const tenant of tenants) {
      const id = tenant.id;
      this.app.graphql.setTenant(id);

      const modelApp = this.app.getApp<ModelApplication>("model");

      let { data: models } = await this.app.cache.getOrSet(
        createCacheKey({ app: "entryPerTenant", key: "models", tenantId: id }),
        async () => {
          const result = await modelApp.list();
          /**
           * Filter out singleton models.
           */
          return {
            ...result,
            data: (result.data || []).filter((model) => {
              if (!model.tags?.length) {
                return true;
              }
              return model.tags.includes("singleEntry") === false;
            }),
          };
        },
      );
      if (!models?.length) {
        logger.error(`Tenant "${tenant.name}" has no models.`);
        this.app.cache.clear();
        continue;
      }
      if (modelsInput[0] !== "*") {
        models = models.filter((m) => {
          const modelId = m.modelId.toLowerCase();
          return modelsInput.some((i) => {
            return i.toLowerCase() === modelId;
          });
        });
      }

      if (models.length === 0) {
        logger.debug("Skipping tenant as no models were found from the selected ones.");
        this.app.cache.clear();
        continue;
      }

      collection[tenant.id] = {};

      for (const model of models) {
        logger.debug(`Creating tenant "${tenant.name}" entries for model "${model.modelId}"...`);
        const variables = await createEntryVariables(model, perTenant);

        if (dryRun) {
          collection[tenant.id][model.modelId] = variables;
          continue;
        }

        const result = await entryApp.createViaGraphQL({
          model,
          variables,
          atOnce: variables.length,
          options: {
            skipValidators: ["required"],
          },
        });
        if (result.errors.length) {
          logger.error("Errors occurred while creating entries.");
          this.app.cache.clear();
          for (const error of result.errors) {
            logger.error(error);
          }
          throw new Error("Errors occurred while creating entries.");
        }
      }
    }
    if (!dryRun || Object.keys(collection).length === 0) {
      return;
    }

    this.store({
      path: dryRunPath,
      collection,
      perTenant,
      tenants: tenantsInput,
      models: modelsInput,
    });
  }

  private store(params: IStoreParams): void {
    const { path: input, collection, tenants, perTenant, models } = params;
    const target = path.resolve("./", path.join(input, `dry-run-${new Date().toISOString()}.json`));
    logger.info(`Storing dry run data into ${target}...`);
    writeJsonFileSync(target, {
      tenants,
      models,
      perTenant,
      values: collection,
    });
  }
}
