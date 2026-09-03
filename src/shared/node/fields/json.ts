import { createField } from "./createField.js";

export const createJsonField = createField({
  type: "json",
  graphQlDefinition: (field) => {
    return field.fieldId;
  },
});
