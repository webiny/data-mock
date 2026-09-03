import { OperationRegistry as Abstraction } from "./abstractions/OperationRegistry.js";
import type { IGraphQLOperation } from "./types.js";

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

function parseVersion(version: string): ParsedVersion {
  const parts = version.split(".");
  return {
    major: Number(parts[0] ?? 0),
    minor: Number(parts[1] ?? 0),
    patch: Number(parts[2] ?? 0),
    raw: version,
  };
}

function isLessOrEqual(a: ParsedVersion, b: ParsedVersion): boolean {
  if (a.major !== b.major) {
    return a.major < b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor;
  }
  return a.patch <= b.patch;
}

class OperationRegistryImpl implements Abstraction.Interface {
  private readonly operations = new Map<string, Map<string, IGraphQLOperation<unknown, unknown>>>();

  public register(version: string, operation: IGraphQLOperation<unknown, unknown>): void {
    let versionMap = this.operations.get(operation.name);
    if (!versionMap) {
      versionMap = new Map();
      this.operations.set(operation.name, versionMap);
    }
    versionMap.set(version, operation);
  }

  public resolve<TInput = void, TOutput = unknown>(
    name: string,
    version: string,
  ): IGraphQLOperation<TInput, TOutput> {
    const versionMap = this.operations.get(name);
    if (!versionMap || versionMap.size === 0) {
      throw new Error(`No operations registered for "${name}".`);
    }

    const exactMatch = versionMap.get(version);
    if (exactMatch) {
      return exactMatch as IGraphQLOperation<TInput, TOutput>;
    }

    const requested = parseVersion(version);
    let bestMatch: IGraphQLOperation<unknown, unknown> | undefined;
    let bestVersion: ParsedVersion | undefined;

    for (const [registeredVersion, operation] of versionMap) {
      const parsed = parseVersion(registeredVersion);
      if (!isLessOrEqual(parsed, requested)) {
        continue;
      }
      if (!bestVersion || !isLessOrEqual(parsed, bestVersion)) {
        bestVersion = parsed;
        bestMatch = operation;
      }
    }

    if (!bestMatch) {
      const available = Array.from(versionMap.keys()).join(", ");
      throw new Error(
        `No compatible operation "${name}" for version "${version}". Available versions: ${available}`,
      );
    }

    return bestMatch as IGraphQLOperation<TInput, TOutput>;
  }
}

export const OperationRegistry = Abstraction.createImplementation({
  implementation: OperationRegistryImpl,
  dependencies: [],
});
