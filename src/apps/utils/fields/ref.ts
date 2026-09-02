import { createField } from "./createField.js";

export const createRefField = createField({
  type: "ref",
  definition: (field) => {
    return `${field.fieldId} {id entryId modelId}`;
  },
});
