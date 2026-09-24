import { EnvironmentHealthCache as Abstraction } from "./abstractions/EnvironmentHealthCache.js";

const TTL_MS = 10 * 60 * 1000;

/**
 * Whether each environment answered, remembered for ten minutes.
 *
 * Health costs a GraphQL round trip and the project list asks once per environment, so a list of
 * seven projects would fire seven requests on every page load without this.
 *
 * It lives in the container rather than in a module-level Map. A Map at module scope is one cache
 * for the whole process: nothing can substitute it, every test shares one, and the only way to get
 * a truthful answer out of it is `force=true` — which is the cache deciding how tests are written.
 */
class EnvironmentHealthCacheImpl implements Abstraction.Interface {
  private readonly entries = new Map<string, { health: Abstraction.Health; checkedAt: number }>();

  public get(environmentId: string): Abstraction.Health | null {
    const entry = this.entries.get(environmentId);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.checkedAt >= TTL_MS) {
      this.entries.delete(environmentId);
      return null;
    }

    return entry.health;
  }

  public set(environmentId: string, health: Abstraction.Health): void {
    this.entries.set(environmentId, { health, checkedAt: Date.now() });
  }

  public forget(environmentId: string): void {
    this.entries.delete(environmentId);
  }
}

export const EnvironmentHealthCache = Abstraction.createImplementation({
  implementation: EnvironmentHealthCacheImpl,
  dependencies: [],
});
