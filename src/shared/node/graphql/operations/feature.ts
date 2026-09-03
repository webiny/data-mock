import { createFeature } from "@webiny/stdlib";
import { OperationRegistry as Abstraction } from "./abstractions/OperationRegistry.js";
import { OperationRegistry } from "./OperationRegistry.js";
import {
  listContentModelGroups,
  listContentModels,
  createContentEntry,
  listContentEntries,
  listTenants,
} from "./base/index.js";

const BASE_VERSION = "6.0.0";

export const OperationsFeature = createFeature({
  name: "GraphQL/OperationsFeature",
  register(container) {
    container.register(OperationRegistry).inSingletonScope();
    const registry = container.resolve(Abstraction);

    registry.register(BASE_VERSION, listContentModelGroups);
    registry.register(BASE_VERSION, listContentModels);
    registry.register(BASE_VERSION, createContentEntry);
    registry.register(BASE_VERSION, listContentEntries);
    registry.register(BASE_VERSION, listTenants);
  },
});
