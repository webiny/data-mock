import { createField } from "./createField.js";

export const createBooleanField = createField({
  type: "boolean",
  definition: (field) => {
    return field.fieldId;
  },
});
