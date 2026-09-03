import { createBooleanField } from "./boolean.js";
import { createDatetimeField } from "~/shared/node/fields/datetime.js";
import { createFileField } from "~/shared/node/fields/file.js";
import { createJsonField } from "~/shared/node/fields/json.js";
import { createLongTextField } from "~/shared/node/fields/richText.js";
import { createNumberField } from "~/shared/node/fields/number.js";
import { createRefField } from "~/shared/node/fields/ref.js";
import { createRichTextField } from "~/shared/node/fields/longText.js";
import { createTextField } from "~/shared/node/fields/text.js";
import { ICreateFieldGraphQlDefinition } from "~/shared/node/fields/createField.js";

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

  return creators.reduce<Record<string, ICreateFieldGraphQlDefinition>>((collection, creator) => {
    const def = creator();

    collection[def.type] = def.graphQlDefinition;

    return collection;
  }, {});
};
