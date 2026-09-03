import { createField } from "./createField.js";

export const createFileField = createField({
  type: "file",
  graphQlDefinition: (field) => {
    return field.fieldId;
  },
});
