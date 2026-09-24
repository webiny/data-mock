import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { BrowseResult } from "~/shared/types.js";
import type { ValidationError } from "~/shared/errors.js";

export interface IDirectoryBrowserInput {
  /** Absolute path to list. Omit to start at the user's home directory. */
  path?: string | undefined;
}

export interface IDirectoryBrowser {
  execute(input: DirectoryBrowser.Input): Promise<Result<BrowseResult, ValidationError>>;
}

export const DirectoryBrowser = createAbstraction<IDirectoryBrowser>("FileSystem/DirectoryBrowser");

export namespace DirectoryBrowser {
  export type Interface = IDirectoryBrowser;
  export type Input = IDirectoryBrowserInput;
}
