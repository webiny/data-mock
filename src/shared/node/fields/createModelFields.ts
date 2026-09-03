import type { ApiCmsModelField } from "~/shared/types.js";
import { createAllowedFields } from "~/shared/node/fields/index.js";

const allowedFieldTypes = createAllowedFields();

export const createModelFields = (fields: ApiCmsModelField[]): string => {
  return fields
    .reduce<string[]>((collection, field) => {
      const create = allowedFieldTypes[field.type];
      if (!create) {
        return collection;
      }

      collection.push(create(field));

      return collection;
    }, [])
    .join("\n");
};
