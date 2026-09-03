import path from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import type { Stats } from "node:fs";
import type { ICache, ICacheKey, ICacheKeyInput } from "./types.js";
import type { Logger } from "@webiny/stdlib";
import { createCacheKey } from "~/shared/node/cache/CacheKey.js";

export interface IFileCacheParams {
  cacheDir?: string;
  ttl?: number;
  logger: Logger.Interface;
}

const defaultCacheDir = "./.cache/";

class FileCache implements ICache {
  private readonly ttl: number = 0;
  private cacheDir: string;
  private disabled: boolean = false;
  private readonly logger: Logger.Interface;

  private keys = new Set<ICacheKey>();

  protected constructor(params: IFileCacheParams) {
    this.cacheDir = params.cacheDir || defaultCacheDir;
    this.ttl = params.ttl || 300;
    this.logger = params.logger;

    this.clearExisting();
  }

  public static create(params: IFileCacheParams) {
    return new this(params);
  }

  public setCacheDir(cacheDir: string): void {
    this.cacheDir = cacheDir;
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
    const cacheKey = createCacheKey(input);
    return this.read<T>(cacheKey);
  }

  public set<T>(input: ICacheKeyInput, value: T): T {
    const cacheKey = createCacheKey(input);
    this.write<T>(cacheKey, value);
    return value;
  }

  public async getOrSet<T>(input: ICacheKeyInput, cb: () => Promise<T>): Promise<T> {
    const cacheKey = createCacheKey(input);
    const existing = this.read<T>(cacheKey);
    if (existing) {
      return existing;
    }
    const value = await cb();
    this.write<T>(cacheKey, value);
    return value;
  }

  public clear(input?: ICacheKeyInput) {
    if (!input) {
      for (const key of this.keys) {
        this.deleteKey(key);
      }
      this.keys.clear();
      return;
    }

    if (Array.isArray(input)) {
      for (const item of input) {
        const cacheKey = createCacheKey(item);
        this.deleteKey(cacheKey);
        this.removeFromKeys(cacheKey);
      }
      return;
    }

    const cacheKey = createCacheKey(input);
    this.deleteKey(cacheKey);
    this.removeFromKeys(cacheKey);
  }

  private read<T>(cacheKey: ICacheKey): T | null {
    this.addKey(cacheKey);
    try {
      const target = this.createPath(cacheKey);
      if (!existsSync(target)) {
        return null;
      }
      const stats = statSync(target);
      if (this.isExpired(stats)) {
        return null;
      }
      const content = readFileSync(target, "utf8");
      if (!content) {
        return null;
      }
      return JSON.parse(content) as T;
    } catch (ex) {
      this.logger.error(ex instanceof Error ? ex.message : String(ex));
      return null;
    }
  }

  private write<T>(cacheKey: ICacheKey, data: T): void {
    this.addKey(cacheKey);
    try {
      const target = this.createPath(cacheKey);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(data, null, 2));
    } catch (ex) {
      this.logger.error(ex instanceof Error ? ex.message : String(ex));
    }
  }

  private deleteKey(cacheKey: ICacheKey): void {
    try {
      unlinkSync(this.createPath(cacheKey));
    } catch {
      //
    }
  }

  private createPath(cacheKey: ICacheKey): string {
    return path.join(this.cacheDir, `${cacheKey.get()}.json`);
  }

  private addKey(cacheKey: ICacheKey): void {
    for (const key of this.keys) {
      if (key.get() === cacheKey.get()) {
        return;
      }
    }
    this.keys.add(cacheKey);
  }

  private removeFromKeys(cacheKey: ICacheKey): void {
    for (const key of this.keys) {
      if (key.get() === cacheKey.get()) {
        this.keys.delete(key);
        return;
      }
    }
  }

  private clearExisting(): void {
    if (!existsSync(this.cacheDir)) {
      return;
    }
    const files = readdirSync(this.cacheDir);
    for (const file of files) {
      const target = path.join(this.cacheDir, file);
      const stats = statSync(target);
      if (!this.isExpired(stats)) {
        continue;
      }
      try {
        unlinkSync(target);
      } catch {
        //
      }
    }
  }

  private isExpired(stats: Stats): boolean {
    return stats.mtime < new Date(Date.now() - this.ttl * 1000);
  }
}

export type { FileCache };

export const createFileCache = (params: IFileCacheParams): ICache => {
  return FileCache.create(params);
};
