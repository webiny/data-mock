import type { Logger } from "@webiny/stdlib";
import type { ApiCmsModel, CmsEntry, GenericRecord } from "~/shared/types.js";
import type { GeneratorRegistry } from "./abstractions/GeneratorRegistry.js";

export interface CreateEntryVariablesOptions {
  availableRefs?: Map<string, string[]>;
}

export async function createEntryVariables(
  generatorRegistry: GeneratorRegistry.Interface,
  logger: Logger.Interface,
  model: Pick<ApiCmsModel, "fields">,
  amount: number,
  options?: CreateEntryVariablesOptions,
): Promise<Array<Pick<CmsEntry<GenericRecord>, "values">>> {
  const availableRefs = options?.availableRefs;
  try {
    return await Promise.all(
      Array(amount)
        .fill(0)
        .map(async () => {
          const entry: Pick<CmsEntry<GenericRecord>, "values"> = {
            values: {},
          };
          for (const field of model.fields) {
            const generator = generatorRegistry.getGenerator({ field });
            entry.values[field.fieldId] = await generator.generate(field, availableRefs);
          }
          return entry;
        }),
    );
  } catch (ex) {
    logger.error(ex instanceof Error ? ex.message : String(ex));
    throw ex;
  }
}
