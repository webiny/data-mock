import { getSeedEntryRoute } from "~/shared/routes/entries.js";
import { GetSeedEntryRepository } from "~/shared/node/features/seeding/entries/abstractions/GetSeedEntryRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const getSeedEntry = routeFactory(getSeedEntryRoute, async ({ params, container, send }) => {
  const repository = container.resolve(GetSeedEntryRepository);
  const result = await repository.execute({ id: params.entryId });

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.one("seedEntry", result.value);
});
