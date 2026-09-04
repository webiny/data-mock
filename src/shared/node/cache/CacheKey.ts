import type { ICacheKey, ICacheKeyInput, ICacheKeyOptions } from "./types.js";
import crypto from "crypto";

class CacheKey implements ICacheKey {
  private readonly key: string;
  public readonly keys: ICacheKeyInput;

  private constructor(keys: ICacheKeyInput) {
    this.keys = keys;
    this.key = createCacheKeyValue(keys, {
      algorithm: "sha256",
      encoding: "hex",
    });
  }

  public static create(key: ICacheKeyInput): ICacheKey {
    return new CacheKey(key);
  }

  public get(): string {
    return this.key;
  }
}

export const createCacheKey = (key: ICacheKeyInput) => {
  return CacheKey.create(key);
};

const getCacheKey = (input: ICacheKeyInput): string => {
  if (typeof input === "string") {
    return input;
  } else if (typeof input === "number") {
    return `${input}`;
  } else if (input instanceof CacheKey) {
    return input.get();
  } else if (Array.isArray(input)) {
    return JSON.stringify(input.map(getCacheKey).join("#"));
  }
  return JSON.stringify(input);
};

export const createCacheKeyValue = (input: ICacheKeyInput, options?: ICacheKeyOptions): string => {
  const key = getCacheKey(input);
  return crypto
    .createHash(options?.algorithm || "sha1")
    .update(key)
    .digest(options?.encoding || "hex");
};
