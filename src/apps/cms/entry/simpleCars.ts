import type {
  ApiCmsSimpleCarMake,
  ApiCmsSimpleCarModel,
  IBaseApplication,
  IEntryApplication,
  IEntryRunnerFactory,
  IEntryRunnerResponse,
  IModelApplication,
} from "~/types.js";
import { carsList } from "./carsList.js";
import baseSlugify from "slugify";
import { logger } from "~/logger.js";

const slugify = (value: string): string => {
  const result = baseSlugify.default(value, {
    replacement: "-",
    lower: true,
    trim: true,
  });

  return result.replace(/\+/g, "");
};

type CmsSimpleCarMake = Pick<ApiCmsSimpleCarMake, "id" | "values">;
type CmsSimpleCarModel = Pick<ApiCmsSimpleCarModel, "id" | "values">;

const simpleCarMakes: CmsSimpleCarMake[] = [];
const simpleCarModels: CmsSimpleCarModel[] = [];
for (const item of carsList) {
  const { brand, models } = item;
  const carMakeId = `simple-car-make-${slugify(brand)}`;
  simpleCarMakes.push({
    id: carMakeId,
    values: {
      name: brand,
    },
  });
  for (const car of models) {
    const carId = `simple-car-model-${slugify(brand)}-${slugify(car)}`;
    simpleCarModels.push({
      id: carId,
      values: {
        name: `${brand} ${car}`,
        make: {
          id: `${carMakeId}#0001`,
          modelId: "simpleCarMake",
        },
      },
    });
  }
}

interface SimpleCarsResult {
  makes: ApiCmsSimpleCarMake[];
  models: ApiCmsSimpleCarModel[];
}

const executeCarsRunner = async (
  app: IBaseApplication,
): Promise<IEntryRunnerResponse<SimpleCarsResult>> => {
  const modelApp = app.getApp<IModelApplication>("model");
  const entryApp = app.getApp<IEntryApplication>("entry");
  /**
   * Models.
   */
  const simpleCarMakeModel = modelApp.getModel("simpleCarMake");
  const simpleCarModelModel = modelApp.getModel("simpleCarModel");
  /**
   * Car makes.
   */
  logger.debug(`Creating ${simpleCarMakes.length} simple car makes...`);
  const { entries: simpleCarMakesResults, errors: simpleCarMakesErrors } =
    await entryApp.createViaGraphQL<ApiCmsSimpleCarMake>({
      model: simpleCarMakeModel,
      variables: simpleCarMakes,
    });
  logger.debug(`...created.`);
  /**
   * Car Models.
   */
  const simpleCarModelsAtOnce = app.getNumberArg("simpleCarModels:atOnce", 10);
  logger.debug(`Creating ${simpleCarModels.length} simple car models...`);
  const { entries: simpleCarModelsResults, errors: simpleCarModelsErrors } =
    await entryApp.createViaGraphQL<ApiCmsSimpleCarModel>({
      model: simpleCarModelModel,
      variables: simpleCarModels,
      atOnce: simpleCarModelsAtOnce,
    });
  logger.debug(`...created.`);

  return {
    makes: simpleCarMakesResults,
    models: simpleCarModelsResults,
    total: simpleCarMakesResults.length + simpleCarModelsResults.length,
    errors: [...simpleCarMakesErrors, ...simpleCarModelsErrors],
  };
};

export const simpleCarsRunnerFactory: IEntryRunnerFactory<SimpleCarsResult> = (app) => {
  return {
    id: "simpleCars",
    name: "Simple Cars",
    exec: () => {
      return executeCarsRunner(app);
    },
  };
};
