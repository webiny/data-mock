import type { ICache, ICacheKeyInput } from "./types.js";
import { createCacheKey } from "~/cache/CacheKey.js";

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
    const cacheKey = createCacheKey(input);

    if (this.disabled) {
      return null;
    }
    const key = cacheKey.get();
    return this._cache.get(key) as T;
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
    if (existing) {
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
