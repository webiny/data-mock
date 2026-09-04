import type { Logger } from "@webiny/stdlib";
import type { ApiCmsModel, CmsEntry, GenericRecord, ProjectFile } from "~/shared/types.js";
import type { GeneratorRegistry } from "./abstractions/GeneratorRegistry.js";

export interface CreateEntryVariablesOptions {
  availableRefs?: Map<string, string[]>;
  filePool?: ProjectFile[];
}

export async function createSingleEntryVariables(
  generatorRegistry: GeneratorRegistry.Interface,
  model: Pick<ApiCmsModel, "fields">,
  availableRefs?: Map<string, string[]>,
  filePool?: ProjectFile[],
): Promise<Pick<CmsEntry<GenericRecord>, "values">> {
  const entry: Pick<CmsEntry<GenericRecord>, "values"> = { values: {} };
  for (const field of model.fields) {
    const generator = generatorRegistry.getGenerator({ field });
    entry.values[field.fieldId] = await generator.generate(field, availableRefs, filePool);
  }
  return entry;
}

export async function createEntryVariables(
  generatorRegistry: GeneratorRegistry.Interface,
  logger: Logger.Interface,
  model: Pick<ApiCmsModel, "fields">,
  amount: number,
  options?: CreateEntryVariablesOptions,
): Promise<Array<Pick<CmsEntry<GenericRecord>, "values">>> {
  const availableRefs = options?.availableRefs;
  const filePool = options?.filePool;
  try {
    const entries: Array<Pick<CmsEntry<GenericRecord>, "values">> = [];
    for (let i = 0; i < amount; i++) {
      entries.push(
        await createSingleEntryVariables(generatorRegistry, model, availableRefs, filePool),
      );
    }
    return entries;
  } catch (ex) {
    logger.error(ex instanceof Error ? ex.message : String(ex));
    throw ex;
  }
}
