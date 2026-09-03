import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/shared/node/db/schema.ts",
	out: "./src/shared/node/db/migrations",
	dialect: "sqlite",
	dbCredentials: {
		url: process.env.DB_PATH ?? "./.webiny/data-mock.db",
	},
});
