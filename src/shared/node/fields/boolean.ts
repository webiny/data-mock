import { createField } from "./createField.js";

export const createBooleanField = createField({
  type: "boolean",
  graphQlDefinition: (field) => {
    return field.fieldId;
  },
});
