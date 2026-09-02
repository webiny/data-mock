import type { CmsGroup } from "./types.js";

export const createBlog = (): CmsGroup => {
  return {
    name: "Blog",
    slug: "blog",
  };
};
