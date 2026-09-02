import type { GroupApplication } from "~/apps/GroupApplication.js";
import type { CmsModel, CmsModelGroup } from "./types.js";

const createSimpleCarsMakeModel = (group: CmsModelGroup): CmsModel => {
  return {
    name: "Simple Car Make",
    modelId: "simpleCarMake",
    singularApiName: "SimpleCarMake",
    pluralApiName: "SimpleCarMakes",
    description: "Simple Car Make model.",
    group: group.slug,
    fields: [
      {
        id: "t9g4uh3gdfsn",
        fieldId: "name",
        label: "Name",
        type: "text",
        validation: [
          {
            name: "required",
            message: "Name is required.",
          },
        ],
        listValidation: [],
        renderer: {
          name: "text-input",
        },
      },
    ],
    layout: [["t9g4uh3gdfsn"]],
  };
};

const createSimpleCarsModelModel = (group: CmsModelGroup): CmsModel => {
  return {
    name: "Simple Car Model",
    modelId: "simpleCarModel",
    singularApiName: "SimpleCarModel",
    pluralApiName: "SimpleCarModels",
    description: "Simple Car Model model.",
    group: group.slug,
    fields: [
      {
        id: "gojfbdangfsa",
        fieldId: "name",
        label: "Name",
        type: "text",
        validation: [
          {
            name: "required",
            message: "Name is required.",
          },
        ],
        listValidation: [],
        renderer: {
          name: "text-input",
        },
      },
      {
        id: "vbfjhasfdbsjw3",
        fieldId: "make",
        label: "Make",
        type: "ref",
        settings: {
          models: [
            {
              modelId: "simpleCarMake",
            },
          ],
        },
        validation: [],
        listValidation: [],
        renderer: {
          name: "ref-advanced-single",
        },
      },
    ],
    layout: [["gojfbdangfsa"], ["vbfjhasfdbsjw3"]],
  };
};

export const createSimpleCarsModels = (app: GroupApplication): CmsModel[] => {
  const group = app.groups.find((g) => g.slug === "cars");
  if (!group) {
    throw new Error(`Missing "cars" group.`);
  }
  return [createSimpleCarsMakeModel(group), createSimpleCarsModelModel(group)];
};
