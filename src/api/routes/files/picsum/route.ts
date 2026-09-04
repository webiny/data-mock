import { pullPicsumImagesRoute } from "~/shared/routes/files.js";
import { PullPicsumImagesService } from "~/shared/node/features/files/picsum/abstractions/PullPicsumImagesService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const pullPicsumImages = routeFactory(
  pullPicsumImagesRoute,
  async ({ body, container, send }) => {
    const service = container.resolve(PullPicsumImagesService);
    const result = await service.execute({
      count: body.count,
      width: body.width,
      height: body.height,
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("result", result.value, 201);
  },
);
