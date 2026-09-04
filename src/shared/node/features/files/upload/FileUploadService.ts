import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { UploadFileRepository } from "./abstractions/UploadFileRepository.js";
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

    // Step 1: get a presigned S3 POST payload for the file.
    const presignedResult = await this.getPreSignedPostPayload(
      graphqlUrl,
      headers,
      fileName,
      fileType,
      fileSize,
    );
    if (presignedResult.isFail()) {
      return Result.fail(presignedResult.error);
    }
    const { payload, file: presignedFile } = presignedResult.value;

    // Step 2: upload the actual file bytes directly to S3.
    const uploadResult = await this.uploadToS3(payload, input.filePath, fileName, fileType);
    if (uploadResult.isFail()) {
      return Result.fail(uploadResult.error);
    }

    // Step 3: create the file record in File Manager, pointing at the uploaded S3 object.
    const createFileResult = await this.createFileRecord(
      graphqlUrl,
      headers,
      presignedFile,
      fileName,
      fileType,
      fileSize,
    );
    if (createFileResult.isFail()) {
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

    this.logger.info(`Uploaded "${fileName}" → ${createdFile.key}`);
    return Result.ok({ file: storeResult.value });
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
  dependencies: [GetProjectRepository, HttpClient, UploadFileRepository, Logger],
});
