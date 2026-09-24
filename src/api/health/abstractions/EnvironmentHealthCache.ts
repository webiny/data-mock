import { createAbstraction } from "@webiny/stdlib";

export interface IEnvironmentHealth {
  reachable: boolean;
  error: string | null;
}

export interface IEnvironmentHealthCache {
  /** The stored answer, or null when there is none or it has aged out. */
  get(environmentId: string): IEnvironmentHealth | null;
  set(environmentId: string, health: IEnvironmentHealth): void;
  /** Drops one environment's answer, for a change that makes it wrong. */
  forget(environmentId: string): void;
}

export const EnvironmentHealthCache = createAbstraction<IEnvironmentHealthCache>(
  "Api/EnvironmentHealthCache",
);

export namespace EnvironmentHealthCache {
  export type Interface = IEnvironmentHealthCache;
  export type Health = IEnvironmentHealth;
}
