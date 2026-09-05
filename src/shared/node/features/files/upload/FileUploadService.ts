import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { UploadFileRepository } from "./abstractions/UploadFileRepository.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import { FileUploadService as Abstraction } from "./abstractions/FileUploadService.js";
import { GraphQLRequestError } from "~/shared/errors.js";

interface PresignedPostPayloadData {
  url: string;
  fields: Record<string, string>;
}

interface PresignedPostFile {
  id: string;
  name: string;
  type: string;
  size: number;
  key: string;
}

interface CreatedFmFile {
  id: string;
  key: string;
  src: string;
  name: string;
  type: string;
  size: number;
}

class FileUploadServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly httpClient: HttpClient.Interface,
    private readonly uploadFileRepository: UploadFileRepository.Interface,
    private readonly createSyncLogRepository: CreateSyncLogRepository.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const projectResult = await this.getProjectRepository.execute({ id: input.projectId });
    if (projectResult.isFail()) {
      return Result.fail(projectResult.error);
    }

    const project = projectResult.value;
    const fileName = basename(input.filePath);
    const stat = statSync(input.filePath);
    const fileSize = stat.size;
    const fileType = guessContentType(fileName);

    this.logger.debug(`Uploading file "${fileName}" (${fileSize} bytes, ${fileType})`);

    const graphqlUrl = `${project.apiUrl.replace(/\/cms\/manage.*$/, "")}/graphql`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${project.apiToken}`,
      "x-tenant": input.tenant,
    };

    const requests: unknown[] = [];
    const responses: unknown[] = [];

    // Step 1: get a presigned S3 POST payload for the file.
    const presignedQuery = `query GetPreSignedPostPayload($data: PreSignedPostPayloadInput!) { fileManager { getPreSignedPostPayload(data: $data) { data { data file { id name type size key } } error { message code } } } }`;
    const presignedVariables = { data: { name: fileName, type: fileType, size: fileSize } };
    const presignedResult = await this.getPreSignedPostPayload(
      graphqlUrl,
      headers,
      fileName,
      fileType,
      fileSize,
    );
    requests.push({
      name: "getPreSignedPostPayload",
      url: graphqlUrl,
      query: presignedQuery,
      variables: presignedVariables,
    });
    responses.push({
      name: "getPreSignedPostPayload",
      httpStatus: presignedResult.isOk() ? 200 : 0,
      body: presignedResult.isOk() ? presignedResult.value : presignedResult.error.data,
    });
    if (presignedResult.isFail()) {
      await this.logUpload(
        input.projectId,
        fileName,
        "error",
        presignedResult.error.message,
        requests,
        responses,
      );
      return Result.fail(presignedResult.error);
    }
    const { payload, file: presignedFile } = presignedResult.value;

    // Step 2: upload the actual file bytes directly to S3.
    const uploadResult = await this.uploadToS3(payload, input.filePath, fileName, fileType);
    requests.push({
      name: "uploadToS3",
      url: payload.url,
      method: "POST (multipart)",
    });
    responses.push({
      name: "uploadToS3",
      httpStatus: uploadResult.isOk() ? 204 : 0,
      body: uploadResult.isOk() ? { status: 204 } : uploadResult.error.data,
    });
    if (uploadResult.isFail()) {
      await this.logUpload(
        input.projectId,
        fileName,
        "error",
        uploadResult.error.message,
        requests,
        responses,
      );
      return Result.fail(uploadResult.error);
    }

    // Step 3: create the file record in File Manager, pointing at the uploaded S3 object.
    const createFileMutation = `mutation CreateFile($data: FmFileCreateInput!) { fileManager { createFile(data: $data) { data { id key src name type size } error { message code } } } }`;
    const createFileVariables = {
      data: {
        id: presignedFile.id,
        key: presignedFile.key,
        name: fileName,
        type: fileType,
        size: fileSize,
      },
    };
    const createFileResult = await this.createFileRecord(
      graphqlUrl,
      headers,
      presignedFile,
      fileName,
      fileType,
      fileSize,
    );
    requests.push({
      name: "createFile",
      url: graphqlUrl,
      query: createFileMutation,
      variables: createFileVariables,
    });
    responses.push({
      name: "createFile",
      httpStatus: createFileResult.isOk() ? 200 : 0,
      body: createFileResult.isOk() ? createFileResult.value : createFileResult.error.data,
    });
    if (createFileResult.isFail()) {
      await this.logUpload(
        input.projectId,
        fileName,
        "error",
        createFileResult.error.message,
        requests,
        responses,
      );
      return Result.fail(createFileResult.error);
    }
    const createdFile = createFileResult.value;

    // Step 4: store the file reference locally.
    const storeResult = await this.uploadFileRepository.execute({
      projectId: input.projectId,
      tenant: input.tenant,
      fileKey: createdFile.key,
      fileUrl: createdFile.src,
      fileName,
      fileType,
      fileSize,
    });

    if (storeResult.isFail()) {
      return Result.fail(storeResult.error);
    }

    await this.logUpload(
      input.projectId,
      fileName,
      "success",
      `Uploaded "${fileName}" to File Manager`,
      requests,
      responses,
    );

    this.logger.info(`Uploaded "${fileName}" → ${createdFile.key}`);
    return Result.ok({ file: storeResult.value });
  }

  private async logUpload(
    projectId: string,
    fileName: string,
    status: "success" | "error",
    message: string,
    requests: unknown[],
    responses: unknown[],
  ): Promise<void> {
    await this.createSyncLogRepository.execute({
      projectId,
      type: "upload-file",
      status,
      message,
      request: requests,
      response: responses,
    });
  }

  private async getPreSignedPostPayload(
    graphqlUrl: string,
    headers: Record<string, string>,
    fileName: string,
    fileType: string,
    fileSize: number,
  ): Promise<
    Result<{ payload: PresignedPostPayloadData; file: PresignedPostFile }, GraphQLRequestError>
  > {
    const query = `
      query GetPreSignedPostPayload($data: PreSignedPostPayloadInput!) {
        fileManager {
          getPreSignedPostPayload(data: $data) {
            data {
              data
              file {
                id
                name
                type
                size
                key
              }
            }
            error {
              message
              code
            }
          }
        }
      }
    `;

    const response = await this.httpClient.post(
      graphqlUrl,
      JSON.stringify({
        query,
        variables: {
          data: {
            name: fileName,
            type: fileType,
            size: fileSize,
          },
        },
      }),
      headers,
    );

    if (response.status !== 200) {
      const text = await response.text().catch(() => "");
      return Result.fail(
        new GraphQLRequestError(
          `Failed to get presigned upload payload (status ${response.status})`,
          response.status,
          text,
        ),
      );
    }

    const json = (await response.json()) as Record<string, unknown>;
    const data = json["data"] as Record<string, unknown> | undefined;
    const fileManager = data?.["fileManager"] as Record<string, unknown> | undefined;
    const result = fileManager?.["getPreSignedPostPayload"] as Record<string, unknown> | undefined;

    if (result?.["error"]) {
      const error = result["error"] as { message: string; code: string };
      return Result.fail(new GraphQLRequestError(error.message, 200, error));
    }

    const resultData = result?.["data"] as Record<string, unknown> | undefined;
    const payload = resultData?.["data"] as PresignedPostPayloadData | undefined;
    const presignedFile = resultData?.["file"] as PresignedPostFile | undefined;

    if (!payload?.url || !payload.fields || !presignedFile) {
      return Result.fail(
        new GraphQLRequestError("Unexpected response from getPreSignedPostPayload", 200),
      );
    }

    return Result.ok({ payload, file: presignedFile });
  }

  private async uploadToS3(
    payload: PresignedPostPayloadData,
    filePath: string,
    fileName: string,
    fileType: string,
  ): Promise<Result<void, GraphQLRequestError>> {
    try {
      const fileBuffer = readFileSync(filePath);
      const formData = new FormData();

      for (const [key, value] of Object.entries(payload.fields)) {
        formData.append(key, value);
      }
      formData.append("file", new Blob([fileBuffer], { type: fileType }), fileName);

      const response = await fetch(payload.url, {
        method: "POST",
        body: formData,
      });

      if (response.status !== 204) {
        const text = await response.text().catch(() => "");
        return Result.fail(
          new GraphQLRequestError(
            `S3 upload failed with status ${response.status}`,
            response.status,
            text,
          ),
        );
      }

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new GraphQLRequestError(
          error instanceof Error ? error.message : "Failed to upload file to S3",
          0,
        ),
      );
    }
  }

  private async createFileRecord(
    graphqlUrl: string,
    headers: Record<string, string>,
    presignedFile: PresignedPostFile,
    fileName: string,
    fileType: string,
    fileSize: number,
  ): Promise<Result<CreatedFmFile, GraphQLRequestError>> {
    const mutation = `
      mutation CreateFile($data: FmFileCreateInput!) {
        fileManager {
          createFile(data: $data) {
            data {
              id
              key
              src
              name
              type
              size
            }
            error {
              message
              code
            }
          }
        }
      }
    `;

    const response = await this.httpClient.post(
      graphqlUrl,
      JSON.stringify({
        query: mutation,
        variables: {
          data: {
            id: presignedFile.id,
            key: presignedFile.key,
            name: fileName,
            type: fileType,
            size: fileSize,
          },
        },
      }),
      headers,
    );

    if (response.status !== 200) {
      const text = await response.text().catch(() => "");
      return Result.fail(
        new GraphQLRequestError(
          `File record creation failed with status ${response.status}`,
          response.status,
          text,
        ),
      );
    }

    const json = (await response.json()) as Record<string, unknown>;
    const data = json["data"] as Record<string, unknown> | undefined;
    const fileManager = data?.["fileManager"] as Record<string, unknown> | undefined;
    const createFile = fileManager?.["createFile"] as Record<string, unknown> | undefined;

    if (createFile?.["error"]) {
      const error = createFile["error"] as { message: string; code: string };
      return Result.fail(new GraphQLRequestError(error.message, 200, error));
    }

    const fileData = createFile?.["data"] as CreatedFmFile | undefined;
    if (!fileData) {
      return Result.fail(new GraphQLRequestError("Unexpected response from file manager", 200));
    }

    return Result.ok(fileData);
  }
}

function guessContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    json: "application/json",
    csv: "text/csv",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}

export const FileUploadService = Abstraction.createImplementation({
  implementation: FileUploadServiceImpl,
  dependencies: [
    GetProjectRepository,
    HttpClient,
    UploadFileRepository,
    CreateSyncLogRepository,
    Logger,
  ],
});
