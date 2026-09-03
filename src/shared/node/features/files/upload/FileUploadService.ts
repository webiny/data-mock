import { statSync } from "node:fs";
import { basename } from "node:path";
import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { UploadFileRepository } from "./abstractions/UploadFileRepository.js";
import { FileUploadService as Abstraction } from "./abstractions/FileUploadService.js";
import { GraphQLRequestError } from "~/shared/errors.js";

class FileUploadServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly encryptionService: EncryptionService.Interface,
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
    const decryptedToken = this.encryptionService.decrypt(project.apiToken);
    const fileName = basename(input.filePath);
    const stat = statSync(input.filePath);
    const fileSize = stat.size;
    const fileType = guessContentType(fileName);

    this.logger.debug(`Uploading file "${fileName}" (${fileSize} bytes, ${fileType})`);

    const createFileMutation = `
      mutation CreateFile($data: FileInput!) {
        fileManager {
          createFile(data: $data) {
            data {
              key
              src
            }
            error {
              message
              code
            }
          }
        }
      }
    `;

    const apiUrl = project.apiUrl.replace(/\/cms\/manage.*$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${decryptedToken}`,
      "x-tenant": input.tenant,
    };

    const response = await this.httpClient.post(
      `${apiUrl}/graphql`,
      JSON.stringify({
        query: createFileMutation,
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
          `File upload failed with status ${response.status}`,
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

    const fileData = createFile?.["data"] as { key: string; src: string } | undefined;
    if (!fileData) {
      return Result.fail(new GraphQLRequestError("Unexpected response from file manager", 200));
    }

    const storeResult = await this.uploadFileRepository.execute({
      projectId: input.projectId,
      tenant: input.tenant,
      fileKey: fileData.key,
      fileUrl: fileData.src,
      fileName,
      fileType,
      fileSize,
    });

    if (storeResult.isFail()) {
      return Result.fail(storeResult.error);
    }

    this.logger.info(`Uploaded "${fileName}" → ${fileData.key}`);
    return Result.ok({ file: storeResult.value });
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
  dependencies: [GetProjectRepository, EncryptionService, HttpClient, UploadFileRepository, Logger],
});
