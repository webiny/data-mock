import type { AcoFolder, ApiGraphQLResult, ApiGraphQLResultJson } from "~/types.js";

export const getAcoFolderResult = (json: ApiGraphQLResultJson): ApiGraphQLResult<AcoFolder> => {
  const { data, extensions = [], errors = [] } = json;
  return {
    data: data?.aco?.data?.data || null,
    error: data?.aco?.data?.error || errors[0],
    extensions,
  };
};
