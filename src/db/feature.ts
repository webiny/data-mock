import { createFeature } from "@webiny/stdlib";
import { DatabaseClient } from "./abstractions/DatabaseClient.js";

interface IDatabaseFeatureContext {
  readonly databaseClient: DatabaseClient.Interface;
}

export const DatabaseFeature = createFeature<IDatabaseFeatureContext>({
  name: "Db/DatabaseFeature",
  register(container, context) {
    container.registerInstance(DatabaseClient, context.databaseClient);
  },
});
