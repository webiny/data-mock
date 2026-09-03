import { createAbstraction } from "@webiny/stdlib";
import type { ICache } from "~/shared/node/cache/types.js";

export const MemoryCache = createAbstraction<ICache>("Cache/MemoryCache");

export namespace MemoryCache {
  export type Interface = ICache;
}
