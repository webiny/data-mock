import { createField } from "./createField.js";

export const createFileField = createField({
  type: "file",
  definition: (field) => {
    return field.fieldId;
  },
});
