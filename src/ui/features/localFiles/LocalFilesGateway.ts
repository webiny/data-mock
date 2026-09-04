import { Result } from "@webiny/stdlib";
import {
  listLocalFilesRoute,
  uploadLocalFileRoute,
  deleteLocalFileRoute,
  pullPicsumImagesRoute,
  uploadGlobalFilesRoute,
} from "~/shared/routes/files.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { LocalFilesGateway as Abstraction } from "./abstractions/LocalFilesGateway.js";
import type {
  ILocalFileVM,
  ILocalFileUploadInput,
  ILocalFilesPullPicsumInput,
  ILocalFilesUploadGlobalToProjectInput,
} from "./abstractions/LocalFilesGateway.js";

class LocalFilesGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(): Promise<Result<ILocalFileVM[], HTTPError>> {
    const result = await this.httpClient.request(listLocalFilesRoute, { params: {} });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.files.items);
  }

  public async upload(input: ILocalFileUploadInput): Promise<Result<ILocalFileVM, HTTPError>> {
    const result = await this.httpClient.request(uploadLocalFileRoute, {
      params: {},
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok({ ...result.value.file, uploadedToProjects: [] });
  }

  public async remove(fileName: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(deleteLocalFileRoute, { params: { fileName } });
  }

  public async pullPicsum(
    input: ILocalFilesPullPicsumInput,
  ): Promise<Result<{ downloaded: number }, HTTPError>> {
    const result = await this.httpClient.request(pullPicsumImagesRoute, {
      params: {},
      body: {
        count: input.count,
        width: input.width ?? 800,
        height: input.height ?? 600,
      },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok({ downloaded: result.value.result.downloaded });
  }

  public async uploadGlobalToProject(
    projectId: string,
    input: ILocalFilesUploadGlobalToProjectInput,
  ): Promise<Result<{ uploaded: number }, HTTPError>> {
    const result = await this.httpClient.request(uploadGlobalFilesRoute, {
      params: { projectId },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok({ uploaded: result.value.result.uploaded });
  }
}

export const LocalFilesGateway = Abstraction.createImplementation({
  implementation: LocalFilesGatewayImpl,
  dependencies: [HTTPClient],
});
