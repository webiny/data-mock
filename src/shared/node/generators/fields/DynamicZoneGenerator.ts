import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import type { ApiCmsModelDynamicZoneField, GenericRecord } from "~/shared/types.js";
import type { IGeneratorGenerateParams } from "../types.js";
import { faker } from "@faker-js/faker";

export class DynamicZoneGenerator extends BaseGenerator<GenericRecord> {
  public type = "dynamicZone";

  public async generate(
    params: IGeneratorGenerateParams<ApiCmsModelDynamicZoneField>,
  ): Promise<GenericRecord | null> {
    const templates = params.field.settings?.templates;
    if (!templates?.length) {
      return null;
    }
    /**
     * `current` is the first template to consider. Clamped, because a value past the last index
     * reaches faker as `min > max` and throws — which fails the entry and, through the seed's
     * stop-at-first-failure rule, abandons the rest of the model.
     */
    const lastIndex = templates.length - 1;
    const first = Math.min(
      Math.max(0, Number(params.field.settings?.current ?? 0) || 0),
      lastIndex,
    );
    const random = faker.number.int({ min: first, max: lastIndex });
    const template = templates[random];
    if (!template) {
      return null;
    }

    const values: GenericRecord = {};
    for (const field of template.fields) {
      const generator = this.getGeneratorByField(field);
      values[field.fieldId] = await generator.generate();
    }
    return {
      [template.gqlTypeName]: values,
    };
  }
}

export class MultiDynamicZoneGenerator extends BaseMultiGenerator<GenericRecord> {
  public type = "dynamicZone";

  public async generate(
    params: IGeneratorGenerateParams<ApiCmsModelDynamicZoneField>,
  ): Promise<GenericRecord[]> {
    const { field } = params;
    const total = field.settings?.templates?.length;
    if (!total) {
      return [];
    }
    return this.iterate(total, async (current) => {
      return await this.getGenerator(DynamicZoneGenerator).generate({
        ...field,
        settings: {
          ...field.settings,
          current,
        },
      });
    });
  }
}
