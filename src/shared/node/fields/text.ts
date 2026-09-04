import { createField } from "./createField.js";

export const createTextField = createField({
  type: "text",
  graphQlDefinition: (field) => {
    return field.fieldId;
  },
});
