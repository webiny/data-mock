import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryCache } from "../MemoryCache.js";
import { createCacheKey } from "../CacheKey.js";
import type { ICache } from "../types.js";

describe("MemoryCache", () => {
  let cache: ICache;

  beforeEach(() => {
    cache = createMemoryCache();
  });

  it("answers a miss with null, not undefined", () => {
    // The signature promises `T | null`. A raw `Map.get` answers `undefined`, and a caller testing
    // `=== null` then reads every miss as a hit.
    expect(cache.get(createCacheKey("nothing-here"))).toBeNull();
  });

  it("stores and returns a value", () => {
    cache.set(createCacheKey("greeting"), "hello");

    expect(cache.get(createCacheKey("greeting"))).toBe("hello");
  });

  it("keys on the value of the input, not its identity", () => {
    cache.set(createCacheKey({ model: "article", tenant: "root" }), 1);

    expect(cache.get(createCacheKey({ model: "article", tenant: "root" }))).toBe(1);
  });

  it("computes a value once and reuses it", () => {
    let calls = 0;
    const compute = (): number => {
      calls += 1;
      return 42;
    };

    expect(cache.getOrSet(createCacheKey("answer"), compute)).toBe(42);
    expect(cache.getOrSet(createCacheKey("answer"), compute)).toBe(42);
    expect(calls).toBe(1);
  });

  it.each([
    ["false", false],
    ["zero", 0],
    ["an empty string", ""],
  ])("treats a cached %s as a hit", (_label, value) => {
    let calls = 0;
    const compute = (): unknown => {
      calls += 1;
      return value;
    };

    cache.getOrSet(createCacheKey("falsy"), compute);
    const second = cache.getOrSet(createCacheKey("falsy"), compute);

    // `if (existing)` recomputed these on every call for as long as the cache lived.
    expect(second).toBe(value);
    expect(calls).toBe(1);
  });

  it("reads nothing while disabled, and computes every time", () => {
    cache.set(createCacheKey("greeting"), "hello");
    cache.disable();

    let calls = 0;
    cache.getOrSet(createCacheKey("greeting"), () => {
      calls += 1;
      return "recomputed";
    });

    expect(cache.get(createCacheKey("greeting"))).toBeNull();
    expect(calls).toBe(1);
  });

  it("writes nothing while disabled", () => {
    cache.disable();
    cache.set(createCacheKey("greeting"), "hello");
    cache.enable();

    expect(cache.get(createCacheKey("greeting"))).toBeNull();
  });

  it("returns what it was asked to store even while disabled", () => {
    cache.disable();

    expect(cache.set(createCacheKey("greeting"), "hello")).toBe("hello");
  });

  it("serves again once re-enabled", () => {
    cache.set(createCacheKey("greeting"), "hello");
    cache.disable();
    cache.enable();

    expect(cache.get(createCacheKey("greeting"))).toBe("hello");
  });

  it("clears one key", () => {
    cache.set(createCacheKey("a"), 1);
    cache.set(createCacheKey("b"), 2);

    cache.clear(createCacheKey("a"));

    expect(cache.get(createCacheKey("a"))).toBeNull();
    expect(cache.get(createCacheKey("b"))).toBe(2);
  });

  it("clears a list of keys", () => {
    cache.set(createCacheKey("a"), 1);
    cache.set(createCacheKey("b"), 2);
    cache.set(createCacheKey("c"), 3);

    cache.clear([createCacheKey("a"), createCacheKey("b")]);

    expect(cache.get(createCacheKey("a"))).toBeNull();
    expect(cache.get(createCacheKey("b"))).toBeNull();
    expect(cache.get(createCacheKey("c"))).toBe(3);
  });

  it("clears everything when given no key", () => {
    cache.set(createCacheKey("a"), 1);
    cache.set(createCacheKey("b"), 2);

    cache.clear();

    expect(cache.get(createCacheKey("a"))).toBeNull();
    expect(cache.get(createCacheKey("b"))).toBeNull();
  });
});
