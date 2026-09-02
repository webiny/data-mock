import { createBooleanField } from "./boolean.js";
import { createDatetimeField } from "~/apps/utils/fields/datetime.js";
import { createFileField } from "~/apps/utils/fields/file.js";
import { createJsonField } from "~/apps/utils/fields/json.js";
import { createLongTextField } from "~/apps/utils/fields/richText.js";
import { createNumberField } from "~/apps/utils/fields/number.js";
import { createRefField } from "~/apps/utils/fields/ref.js";
import { createRichTextField } from "~/apps/utils/fields/longText.js";
import { createTextField } from "~/apps/utils/fields/text.js";
import { ICreateFieldDefinition } from "~/apps/utils/fields/createField.js";

export const createAllowedFields = () => {
  const creators = [
    createBooleanField,
    createDatetimeField,
    createFileField,
    createJsonField,
    createLongTextField,
    createNumberField,
    createRefField,
    createRichTextField,
    createTextField,
  ];

  return creators.reduce<Record<string, ICreateFieldDefinition>>((collection, creator) => {
    const def = creator();

    collection[def.type] = def.definition;

    return collection;
  }, {});
};
