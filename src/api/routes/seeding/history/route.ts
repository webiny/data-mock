import { listSeedJobsRoute } from "~/shared/routes/seeding.js";
import { ListSeedJobsRepository } from "~/shared/node/features/seeding/list/abstractions/ListSeedJobsRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import { parseListQuery, getStringFilter } from "~/api/routing/parseListQuery.js";
import type { SeedJobStatus } from "~/shared/types.js";

function isSeedJobStatus(value: string | undefined): value is SeedJobStatus {
  return (
    value === "pending" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "dry-run"
  );
}

export const listSeedJobs = routeFactory(
  listSeedJobsRoute,
  async ({ params, query, container, send }) => {
    const { limit, offset, sortField, sortDir } = parseListQuery(query);

    const input: ListSeedJobsRepository.Input = {
      projectId: params.projectId,
      limit,
      offset,
      sortDir,
    };
    if (sortField) {
      input.sortField = sortField;
    }
    const status = getStringFilter(query, "status");
    if (isSeedJobStatus(status)) {
      input.status = status;
    }

    const repository = container.resolve(ListSeedJobsRepository);
    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("seedJobs", result.value.seedJobs, result.value.total);
  },
);
