import { createField } from "./createField.js";

export const createTextField = createField({
  type: "text",
  definition: (field) => {
    return field.fieldId;
  },
});
