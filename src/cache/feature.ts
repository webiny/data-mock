import { createFeature } from "@webiny/stdlib";
import { FileCache as FileCacheAbstraction } from "./abstractions/FileCache.js";
import { MemoryCache as MemoryCacheAbstraction } from "./abstractions/MemoryCache.js";
import { createFileCache } from "./FileCache.js";
import { createMemoryCache } from "./MemoryCache.js";

const DEFAULT_CACHE_DIR = "./.webiny/cache/";

interface ICacheFeatureContext {
  readonly cacheDir?: string;
}

export const CacheFeature = createFeature<ICacheFeatureContext>({
  name: "Cache/CacheFeature",
  register(container, context) {
    const cacheDir = context?.cacheDir ?? DEFAULT_CACHE_DIR;
    const fileCache = createFileCache({ cacheDir });
    const memoryCache = createMemoryCache();

    container.registerInstance(FileCacheAbstraction, fileCache);
    container.registerInstance(MemoryCacheAbstraction, memoryCache);
  },
});
