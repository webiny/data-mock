import { Container } from "@webiny/di";
import { sql } from "drizzle-orm";
import { AppFeature } from "./shared/node/feature.js";
import { DatabaseClient } from "./shared/node/db/abstractions/DatabaseClient.js";

const container = new Container();
AppFeature.register(container);

const client = container.resolve(DatabaseClient);
const result = client.db.all<{ name: string }>(
  sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
);

console.log("Container bootstrapped successfully.");
console.log("Tables:", result.map((r) => r.name).join(", "));
