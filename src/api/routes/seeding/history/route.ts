import { listSeedJobsRoute } from "~/shared/routes/seeding.js";
import { ListSeedJobsRepository } from "~/shared/node/features/seeding/list/abstractions/ListSeedJobsRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listSeedJobs = routeFactory(listSeedJobsRoute, async ({ params, container, send }) => {
  const repository = container.resolve(ListSeedJobsRepository);
  const result = await repository.execute({ projectId: params.projectId });

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.list("seedJobs", result.value, result.value.length);
});
