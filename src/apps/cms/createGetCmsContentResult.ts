import type { ApiGraphQLResult, ApiGraphQLResultJson } from "~/types.js";

interface IDataCallable<T> {
  (data: T): T;
}

export const createGetCmsContentResult = <T>(cb?: IDataCallable<T>) => {
  return (json: ApiGraphQLResultJson): ApiGraphQLResult<T> => {
    const { data: result, extensions = [], errors = [] } = json;

    const data = result?.data?.data || null;
    return {
      data: cb ? cb(data) : data,
      error: result?.data?.error || errors[0],
      extensions,
    };
  };
};
