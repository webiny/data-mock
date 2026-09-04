import type { FastifyInstance } from "fastify";
import { listJobs } from "./list/route.js";
import { getJob } from "./get/route.js";
import { enqueueJob } from "./enqueue/route.js";
import { cancelJob } from "./cancel/route.js";

export async function registerJobRoutes(app: FastifyInstance): Promise<void> {
  await listJobs(app);
  await getJob(app);
  await enqueueJob(app);
  await cancelJob(app);
}
