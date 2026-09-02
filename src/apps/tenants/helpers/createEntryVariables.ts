import type { ApiCmsModel, CmsEntry, GenericRecord } from "~/types.js";
import { getGenerator } from "./generators/index.js";
import { logger } from "~/logger.js";

export const createEntryVariables = async (model: Pick<ApiCmsModel, "fields">, amount: number) => {
  try {
    return await Promise.all(
      Array(amount)
        .fill(0)
        .map(async () => {
          const entry: Pick<CmsEntry<GenericRecord>, "values"> = {
            values: {},
          };
          for (const field of model.fields) {
            const generator = getGenerator({
              field,
            });
            entry.values[field.fieldId] = await generator.generate(field);
          }
          return entry;
        }),
    );
  } catch (ex) {
    logger.info("");
    logger.error(ex);
    throw ex;
  }
};
