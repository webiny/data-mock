import { Result } from "@webiny/stdlib";
import type { BrowseResult, ScanResult, ScanRoot } from "~/shared/types.js";
import {
  browseDirectoryRoute,
  createScanRootRoute,
  listScanRootsRoute,
  removeScanRootRoute,
  scanForProjectsRoute,
} from "~/shared/routes/filesystem.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { FileSystemGateway as Abstraction } from "./abstractions/FileSystemGateway.js";

class FileSystemGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async browse(path?: string): Promise<Result<BrowseResult, HTTPError>> {
    const result = await this.httpClient.request(browseDirectoryRoute, {
      params: {},
      query: path === undefined ? undefined : { path },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.browse);
  }

  public async scan(paths?: string[]): Promise<Result<ScanResult, HTTPError>> {
    const result = await this.httpClient.request(scanForProjectsRoute, {
      params: {},
      body: paths === undefined ? {} : { paths },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.scan);
  }

  public async listScanRoots(): Promise<Result<ScanRoot[], HTTPError>> {
    const result = await this.httpClient.request(listScanRootsRoute, { params: {} });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.scanRoots.items);
  }

  public async addScanRoot(path: string): Promise<Result<ScanRoot, HTTPError>> {
    const result = await this.httpClient.request(createScanRootRoute, {
      params: {},
      body: { path },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.scanRoot);
  }

  public async removeScanRoot(id: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(removeScanRootRoute, { params: { id } });
  }
}

export const FileSystemGateway = Abstraction.createImplementation({
  implementation: FileSystemGatewayImpl,
  dependencies: [HTTPClient],
});
