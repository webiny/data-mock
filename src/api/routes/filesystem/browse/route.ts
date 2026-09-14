import { browseDirectoryRoute } from "~/shared/routes/filesystem.js";
import { DirectoryBrowser } from "~/shared/node/features/filesystem/browse/abstractions/DirectoryBrowser.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const browseDirectory = routeFactory(
  browseDirectoryRoute,
  async ({ query, container, send }) => {
    const browser = container.resolve(DirectoryBrowser);
    const result = await browser.execute({ path: query.path });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("browse", result.value);
  },
);
