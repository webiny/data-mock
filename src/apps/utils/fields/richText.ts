import { createField } from "./createField.js";

export const createLongTextField = createField({
  type: "long-text",
  definition: (field) => {
    return field.fieldId;
  },
});
