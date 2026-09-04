import { createAbstraction } from "@webiny/stdlib";
import type { ICache } from "../types.js";

export const FileCache = createAbstraction<ICache>("Cache/FileCache");

export namespace FileCache {
  export type Interface = ICache;
}
