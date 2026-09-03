import { createField } from "./createField.js";

export const createLongTextField = createField({
  type: "long-text",
  graphQlDefinition: (field) => {
    return field.fieldId;
  },
});
