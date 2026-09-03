import { createField } from "./createField.js";

export const createDatetimeField = createField({
  type: "datetime",
  graphQlDefinition: (field) => {
    return field.fieldId;
  },
});
