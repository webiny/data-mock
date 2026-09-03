import type { Container } from "@webiny/di";

interface FeatureDefinition<TRegister = void, TExports = undefined> {
  name: string;
  dependencies?: Array<{ register(container: Container, context?: unknown): void }>;
  register(container: Container, context: TRegister): void;
  resolve?: (container: Container) => TExports;
}

export interface Feature<TRegister = void, TExports = undefined> {
  name: string;
  register(container: Container, context?: TRegister): void;
  resolve: TExports extends undefined ? never : (container: Container) => TExports;
}

const registeredFeatures = new WeakMap<Container, Set<string>>();

export function createFeature<TRegister = void, TExports = undefined>(
  def: FeatureDefinition<TRegister, TExports>,
): Feature<TRegister, TExports> {
  return {
    name: def.name,
    register(container: Container, context?: TRegister) {
      let registered = registeredFeatures.get(container);
      if (!registered) {
        registered = new Set();
        registeredFeatures.set(container, registered);
      }
      if (registered.has(def.name)) {
        return;
      }
      registered.add(def.name);

      if (def.dependencies) {
        for (const dep of def.dependencies) {
          dep.register(container);
        }
      }
      def.register(container, context as TRegister);
    },
    resolve: def.resolve as Feature<TRegister, TExports>["resolve"],
  };
}
