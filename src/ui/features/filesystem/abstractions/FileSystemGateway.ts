import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { BrowseResult, ScanResult, ScanRoot } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IFileSystemGateway {
  /** Omit `path` to start at the user's home directory. */
  browse(path?: string): Promise<Result<BrowseResult, HTTPError>>;
  /** Omit `paths` to scan every saved root. */
  scan(paths?: string[]): Promise<Result<ScanResult, HTTPError>>;
  listScanRoots(): Promise<Result<ScanRoot[], HTTPError>>;
  addScanRoot(path: string): Promise<Result<ScanRoot, HTTPError>>;
  removeScanRoot(id: string): Promise<Result<void, HTTPError>>;
}

export const FileSystemGateway = createAbstraction<IFileSystemGateway>("Ui/FileSystemGateway");

export namespace FileSystemGateway {
  export type Interface = IFileSystemGateway;
}
