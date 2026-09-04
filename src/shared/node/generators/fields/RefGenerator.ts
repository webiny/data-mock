import { faker } from "@faker-js/faker";
import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import type { IGeneratorGenerateParams } from "../types.js";

interface Ref {
  modelId: string;
  id: string;
}

function pickRef(params: IGeneratorGenerateParams): Ref | null {
  const { field, availableRefs } = params;
  if (!availableRefs) {
    return null;
  }

  const models = (field.settings?.models ?? []) as Array<{ modelId: string }>;
  for (const m of models) {
    const ids = availableRefs.get(m.modelId);
    if (ids && ids.length > 0) {
      const id = faker.helpers.arrayElement(ids);
      return { modelId: m.modelId, id };
    }
  }

  return null;
}

export class RefGenerator extends BaseGenerator<Ref> {
  public type = "ref";

  public async generate(params: IGeneratorGenerateParams): Promise<Ref | null> {
    return pickRef(params);
  }
}

export class MultiRefGenerator extends BaseMultiGenerator<Ref> {
  public type = "ref";

  public async generate(params: IGeneratorGenerateParams): Promise<Ref[] | null> {
    const { availableRefs, field } = params;
    if (!availableRefs) {
      return null;
    }

    const models = (field.settings?.models ?? []) as Array<{ modelId: string }>;
    const results: Ref[] = [];

    for (const m of models) {
      const ids = availableRefs.get(m.modelId);
      if (ids && ids.length > 0) {
        const count = faker.number.int({ min: 1, max: Math.min(3, ids.length) });
        const picked = faker.helpers.arrayElements(ids, count);
        for (const id of picked) {
          results.push({ modelId: m.modelId, id });
        }
      }
    }

    return results.length > 0 ? results : null;
  }
}
