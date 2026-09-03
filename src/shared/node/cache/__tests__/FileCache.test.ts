import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Container } from "@webiny/di";
import { Logger } from "@webiny/stdlib";
import { PinoLoggerFeature } from "@webiny/stdlib/node";
import { createFileCache } from "../FileCache.js";
import { createCacheKey } from "../CacheKey.js";

const TEST_DIR = join(process.cwd(), ".webiny", "test-cache");

function createTestCache(ttl: number = 300) {
  const cacheDir = join(TEST_DIR, randomUUID());
  mkdirSync(cacheDir, { recursive: true });

  const container = new Container();
  PinoLoggerFeature.register(container);
  const logger = container.resolve(Logger);

  const cache = createFileCache({ cacheDir, ttl, logger });
  return { cache, cacheDir };
}

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("FileCache", () => {
  it("should set and get a value", () => {
    const { cache } = createTestCache();
    const key = createCacheKey("test-key");
    cache.set(key, { hello: "world" });
    const result = cache.get<{ hello: string }>(key);
    expect(result).toEqual({ hello: "world" });
  });

  it("should return null for non-existent key", () => {
    const { cache } = createTestCache();
    const key = createCacheKey("missing-key");
    const result = cache.get(key);
    expect(result).toBeNull();
  });

  it("should return null after TTL expiry", async () => {
    const { cache } = createTestCache(1);
    const key = createCacheKey("expiring-key");
    cache.set(key, "value");

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const result = cache.get(key);
    expect(result).toBeNull();
  });

  it("should store different values for different keys", () => {
    const { cache } = createTestCache();
    const key1 = createCacheKey("key-1");
    const key2 = createCacheKey("key-2");
    cache.set(key1, "value-1");
    cache.set(key2, "value-2");

    expect(cache.get(key1)).toBe("value-1");
    expect(cache.get(key2)).toBe("value-2");
  });

  it("should return null when disabled", () => {
    const { cache } = createTestCache();
    const key = createCacheKey("disabled-key");
    cache.set(key, "value");
    cache.disable();

    expect(cache.get(key)).toBeNull();
  });

  it("should return values again after re-enable", () => {
    const { cache } = createTestCache();
    const key = createCacheKey("toggle-key");
    cache.set(key, "value");
    cache.disable();
    expect(cache.get(key)).toBeNull();

    cache.enable();
    expect(cache.get(key)).toBe("value");
  });

  it("should support getOrSet for cache-miss", async () => {
    const { cache } = createTestCache();
    let callCount = 0;
    const factory = async () => {
      callCount++;
      return "computed-value";
    };

    const first = await cache.getOrSet("gor-key", factory);
    expect(first).toBe("computed-value");
    expect(callCount).toBe(1);

    const second = await cache.getOrSet("gor-key", factory);
    expect(second).toBe("computed-value");
    expect(callCount).toBe(1);
  });
});
