import { createField } from "./createField.js";

export const createNumberField = createField({
  type: "number",
  graphQlDefinition: (field) => {
    return field.fieldId;
  },
});
