import type { ICache, ICacheKeyInput } from "~/shared/node/cache/types.js";
import { createCacheKey } from "~/shared/node/cache/CacheKey.js";

class MemoryCache implements ICache {
  private _cache: Map<string, unknown> = new Map();

  private disabled: boolean = false;

  protected constructor() {
    // Prevent direct instantiation.
  }

  public static create() {
    return new this();
  }

  public disable(): void {
    this.disabled = true;
  }

  public enable(): void {
    this.disabled = false;
  }

  public get<T>(input: ICacheKeyInput): T | null {
    if (this.disabled) {
      return null;
    }
    const key = createCacheKey(input).get();
    // `Map.get` answers a miss with `undefined`, which this signature promises as `null`. Returned
    // raw, a caller testing `=== null` reads every miss as a hit.
    return this._cache.has(key) ? (this._cache.get(key) as T) : null;
  }

  public set<T>(input: ICacheKeyInput, value: T): T {
    if (this.disabled) {
      return value;
    }
    const cacheKey = createCacheKey(input);
    const key = cacheKey.get();
    this._cache.set(key, value);
    return value;
  }

  public getOrSet<T>(input: ICacheKeyInput, cb: () => T): T {
    if (this.disabled) {
      return cb();
    }
    const cacheKey = createCacheKey(input);
    const existing = this.get<T>(cacheKey);
    // Not `if (existing)`: a cached `false`, `0` or `""` is a hit, and treating it as a miss
    // recomputes it on every call for as long as the cache lives.
    if (existing !== null) {
      return existing;
    }
    const value = cb();
    return this.set<T>(cacheKey, value);
  }

  public clear(input?: ICacheKeyInput | ICacheKeyInput[]) {
    if (!input) {
      this._cache.clear();
      return;
    } else if (Array.isArray(input)) {
      for (const keyInput of input) {
        const key = createCacheKey(keyInput);
        this._cache.delete(key.get());
      }
      return;
    }

    const key = createCacheKey(input);
    this._cache.delete(key.get());
  }
}

export const createMemoryCache = (): ICache => {
  return MemoryCache.create();
};
