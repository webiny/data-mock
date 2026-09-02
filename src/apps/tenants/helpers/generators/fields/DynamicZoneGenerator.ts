import { BaseGenerator, BaseMultiGenerator } from "./BaseGenerator.js";
import pReduce from "p-reduce";
import { registry } from "../registry.js";
import { ApiCmsModelDynamicZoneField, GenericRecord } from "~/types.js";
import type { IGeneratorGenerateParams } from "../types.js";
import { faker } from "@faker-js/faker";

class DynamicZoneGenerator extends BaseGenerator<GenericRecord> {
  public type = "dynamicZone";

  public async generate(
    params: IGeneratorGenerateParams<ApiCmsModelDynamicZoneField>,
  ): Promise<GenericRecord | null> {
    const templates = params.field.settings?.templates;
    if (!templates.length) {
      return null;
    }
    const random = faker.number.int({
      /**
       * There is a possibility that we send a current value.
       */
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      min: params.field.settings?.current || 0,
      max: templates.length - 1,
    });
    const template = templates[random];
    if (!template) {
      return null;
    }

    const values = await pReduce(
      template.fields,
      async (collection, field) => {
        const generator = this.getGeneratorByField(field);
        collection[field.fieldId] = await generator.generate();
        return collection;
      },
      {} as GenericRecord,
    );
    return {
      [template.gqlTypeName]: values,
    };
  }
}

class MultiDynamicZoneGenerator extends BaseMultiGenerator<GenericRecord> {
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

registry.registerGenerator(DynamicZoneGenerator);
registry.registerGenerator(MultiDynamicZoneGenerator);
