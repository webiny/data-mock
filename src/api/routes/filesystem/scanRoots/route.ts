import {
  createScanRootRoute,
  listScanRootsRoute,
  removeScanRootRoute,
} from "~/shared/routes/filesystem.js";
import { CreateScanRootRepository } from "~/shared/node/features/scanRoots/create/abstractions/CreateScanRootRepository.js";
import { ListScanRootsRepository } from "~/shared/node/features/scanRoots/list/abstractions/ListScanRootsRepository.js";
import { RemoveScanRootRepository } from "~/shared/node/features/scanRoots/remove/abstractions/RemoveScanRootRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listScanRoots = routeFactory(listScanRootsRoute, async ({ container, send }) => {
  const repository = container.resolve(ListScanRootsRepository);
  const result = await repository.execute();

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.list("scanRoots", result.value, result.value.length);
});

export const createScanRoot = routeFactory(
  createScanRootRoute,
  async ({ body, container, send }) => {
    const repository = container.resolve(CreateScanRootRepository);
    const result = await repository.execute({ path: body.path });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("scanRoot", result.value, 201);
  },
);

export const removeScanRoot = routeFactory(
  removeScanRootRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(RemoveScanRootRepository);
    const result = await repository.execute({ id: params.id });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
