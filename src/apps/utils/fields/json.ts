import { createField } from "./createField.js";

export const createJsonField = createField({
  type: "json",
  definition: (field) => {
    return field.fieldId;
  },
});
