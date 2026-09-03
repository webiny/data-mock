import { createField } from "./createField.js";

export const createRefField = createField({
  type: "ref",
  graphQlDefinition: (field) => {
    return `${field.fieldId} {id entryId modelId}`;
  },
});
