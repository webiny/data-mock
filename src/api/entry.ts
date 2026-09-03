import { Container } from "@webiny/di";
import { AppFeature } from "~/feature.js";
import { ApiFeature } from "./feature.js";
import { createServer } from "./server.js";
import { registerApiRoutes } from "./routes/index.js";

const PORT = Number(process.env.API_PORT ?? 3001);
const HOST = "127.0.0.1";

const container = new Container();
AppFeature.register(container);
ApiFeature.register(container);

const app = await createServer(container, [registerApiRoutes]);

await app.listen({ port: PORT, host: HOST });
console.log(`API server running on http://${HOST}:${PORT}`);
