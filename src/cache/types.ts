import type { GenericRecord } from "~/types.js";
import type { BinaryToTextEncoding } from "node:crypto";

export interface ICacheKeyOptions {
  algorithm?: CacheKeyAlgorithmType;
  encoding?: BinaryToTextEncoding;
}

export type CacheKeyAlgorithmType = "md5" | "sha1" | "sha224" | "sha256" | "sha384" | "sha512";

export interface ICacheKey {
  get(): string;
  keys: ICacheKeyInput;
}

export type ICacheKeyInput =
  | ICacheKey
  | ICacheKey[]
  | GenericRecord
  | (string | number | GenericRecord)[]
  | string
  | number;

export interface ICache {
  disable(): void;
  enable(): void;
  get<T>(cacheKey: ICacheKey): T | null;
  set<T>(cacheKey: ICacheKey, value: T): T;
  getOrSet<T>(cacheKey: ICacheKeyInput, cb: () => Promise<T>): Promise<T>;
  getOrSet<T>(cacheKey: ICacheKeyInput, cb: () => T): T;
  clear(cacheKey?: ICacheKey | ICacheKey[]): void;
}
