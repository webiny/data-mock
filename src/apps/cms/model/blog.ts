import type { CmsModel, CmsModelGroup } from "./types.js";
import type { GroupApplication } from "~/apps/GroupApplication.js";

const createCategoryModel = (group: CmsModelGroup): CmsModel => {
  return {
    name: "Category",
    modelId: "category",
    singularApiName: "Category",
    pluralApiName: "Categories",
    description: "Category model.",
    group: group.slug,
    fields: [
      {
        id: "aBhLozTf",
        fieldId: "title",
        label: "Title",
        type: "text",
        validation: [
          {
            name: "required",
            message: "Title is required.",
          },
        ],
        listValidation: [],
        renderer: {
          name: "text-input",
        },
      },
    ],
    layout: [["aBhLozTf"]],
  };
};

const createAuthorModel = (group: CmsModelGroup): CmsModel => {
  return {
    name: "Author",
    singularApiName: "Author",
    pluralApiName: "Authors",
    modelId: "author",
    description: "Author model.",
    group: group.slug,
    fields: [
      {
        id: "g36yFndu",
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
        id: "rLT9tSeG",
        fieldId: "dateOfBirth",
        label: "Date of Birth",
        type: "datetime",
        validation: [
          {
            name: "required",
            message: "Age is required.",
          },
        ],
        listValidation: [],
        settings: {
          type: "date",
        },
        renderer: {
          name: "date-time-input",
        },
      },
    ],
    layout: [["g36yFndu"], ["rLT9tSeG"]],
  };
};

const createArticleModel = (group: CmsModelGroup): CmsModel => {
  return {
    name: "Article",
    singularApiName: "Article",
    pluralApiName: "Articles",
    modelId: "article",
    description: "Article model.",
    group: group.slug,
    fields: [
      {
        id: "nXB3IMab",
        fieldId: "title",
        label: "Title",
        type: "text",
        validation: [
          {
            name: "required",
            message: "Title is required.",
          },
        ],
        listValidation: [],
        renderer: {
          name: "text-input",
        },
      },
      {
        id: "bsWTA2Pj",
        fieldId: "description",
        label: "Description",
        type: "long-text",
        validation: [],
        listValidation: [],
        renderer: {
          name: "long-text-text-area",
        },
      },
      {
        id: "HAUGedBn",
        fieldId: "body",
        label: "Body",
        type: "rich-text",
        validation: [],
        listValidation: [],
        renderer: {
          name: "lexical-text-input",
        },
      },
      {
        id: "rK8YsHwQ",
        fieldId: "author",
        label: "Author",
        type: "ref",
        validation: [],
        listValidation: [],
        settings: {
          models: [
            {
              modelId: "author",
            },
          ],
        },
        renderer: {
          name: "ref-advanced-single",
        },
      },
      {
        id: "ckkDA58r",
        fieldId: "categories",
        label: "Categories",
        type: "ref",
        list: true,
        settings: {
          models: [
            {
              modelId: "category",
            },
          ],
        },
        validation: [],
        listValidation: [],
        renderer: {
          name: "ref-advanced-multiple",
        },
      },
    ],
    layout: [["nXB3IMab"], ["bsWTA2Pj"], ["HAUGedBn"], ["rK8YsHwQ", "ckkDA58r"]],
  };
};

export const createBlogModels = (app: GroupApplication): CmsModel[] => {
  const group = app.groups.find((g) => g.slug === "blog");
  if (!group) {
    throw new Error(`Missing "blog" group.`);
  }
  return [createCategoryModel(group), createAuthorModel(group), createArticleModel(group)];
};
