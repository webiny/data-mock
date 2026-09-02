import { createField } from "./createField.js";

export const createRichTextField = createField({
  type: "rich-text",
  definition: (field) => {
    return field.fieldId;
  },
});
