import { createAbstraction } from "@webiny/stdlib";
import type { ICache } from "../types.js";

export const MemoryCache = createAbstraction<ICache>("Cache/MemoryCache");

export namespace MemoryCache {
  export type Interface = ICache;
}
