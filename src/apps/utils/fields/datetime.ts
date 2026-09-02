import { createField } from "./createField.js";

export const createDatetimeField = createField({
  type: "datetime",
  definition: (field) => {
    return field.fieldId;
  },
});
