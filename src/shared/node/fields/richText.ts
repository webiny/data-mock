import { createField } from "./createField.js";

export const createRichTextField = createField({
  type: "rich-text",
  graphQlDefinition: (field) => {
    return field.fieldId;
  },
});
