import { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import {
  listProjectFilesRoute,
  uploadProjectFileRoute,
  deleteProjectFileRoute,
  pullProjectFilesRoute,
} from "~/shared/routes/files.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { FilesGateway as Abstraction } from "./abstractions/FilesGateway.js";
import type { IPullFilesResult } from "./abstractions/FilesGateway.js";

class FilesGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(projectId: string): Promise<Result<ProjectFile[], HTTPError>> {
    const result = await this.httpClient.request(listProjectFilesRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.files.items);
  }

  public async upload(
    projectId: string,
    input: Abstraction.UploadInput,
  ): Promise<Result<ProjectFile, HTTPError>> {
    const result = await this.httpClient.request(uploadProjectFileRoute, {
      params: { projectId },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.file);
  }

  public async remove(projectId: string, fileId: string): Promise<Result<void, HTTPError>> {
    const result = await this.httpClient.request(deleteProjectFileRoute, {
      params: { projectId, fileId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(undefined);
  }

  public async pullFiles(
    projectId: string,
    tenant: string,
  ): Promise<Result<IPullFilesResult, HTTPError>> {
    const result = await this.httpClient.request(pullProjectFilesRoute, {
      params: { projectId },
      body: { tenant },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.result);
  }
}

export const FilesGateway = Abstraction.createImplementation({
  implementation: FilesGatewayImpl,
  dependencies: [HTTPClient],
});
