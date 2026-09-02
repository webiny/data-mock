import { createField } from "./createField.js";

export const createNumberField = createField({
  type: "number",
  definition: (field) => {
    return field.fieldId;
  },
});
