import { createAbstraction } from "@webiny/stdlib";

/**
 * Four ways to name the project being added. The first three all produce a `rootPath`; `remote`
 * is the pre-existing flow for a project with no checkout on this machine.
 */
export type AddProjectMode = "browse" | "path" | "scan" | "remote";

export interface BrowseEntryVM {
  name: string;
  path: string;
  isWebinyProject: boolean;
  /** False when the directory exists but cannot be opened. Shown, not hidden. */
  readable: boolean;
}

export interface ScanRootVM {
  id: string;
  path: string;
}

export interface ScanCandidateVM {
  rootPath: string;
  name: string;
  /** "v6.4.9", or "workspace root" when the checkout has no resolvable version. */
  versionLabel: string;
  /** Already a project here — selecting it would collide with the existing row. */
  registered: boolean;
  /**
   * A project of this name exists but names no checkout. Picking this one attaches the checkout to
   * it rather than creating a second project for the same system.
   */
  attachable: boolean;
  selected: boolean;
}

export interface AddProjectVM {
  mode: AddProjectMode;
  name: string;
  /** The chosen checkout, for every mode but `remote`. */
  rootPath: string;

  browsePath: string;
  /** Null at the filesystem root. */
  browseParentPath: string | null;
  browseEntries: BrowseEntryVM[];
  /** True when the directory currently listed is itself a checkout. */
  browseIsWebinyProject: boolean;
  isBrowsing: boolean;

  scanRoots: ScanRootVM[];
  newScanRootPath: string;
  candidates: ScanCandidateVM[];
  /** How many checkouts are ticked. Scan mode adds all of them at once. */
  selectedCount: number;
  /** How many could be ticked — registered ones cannot. */
  selectableCount: number;
  scanErrors: Array<{ path: string; message: string }>;
  isScanning: boolean;
  /** True once a scan has run, so "no projects found" is distinguishable from "not scanned". */
  hasScanned: boolean;

  apiUrl: string;
  apiToken: string;
  tenant: string;
  webinyVersion: string;

  isSubmitting: boolean;
  error: string | null;
  canSubmit: boolean;
}

export interface IAddProjectPresenter {
  readonly vm: AddProjectVM;
  setMode(mode: AddProjectMode): void;
  setName(value: string): void;
  setRootPath(value: string): void;
  setApiUrl(value: string): void;
  setApiToken(value: string): void;
  setTenant(value: string): void;
  setWebinyVersion(value: string): void;
  /** Lists a directory. Omit the path to start at the user's home directory. */
  browse(path?: string): Promise<void>;
  browseUp(): Promise<void>;
  /** Picks the directory currently listed as the checkout to register. */
  chooseBrowsedDirectory(): void;
  setNewScanRootPath(value: string): void;
  addScanRoot(): Promise<void>;
  removeScanRoot(id: string): Promise<void>;
  loadScanRoots(): Promise<void>;
  scan(): Promise<void>;
  /** Ticks or unticks one checkout. Several can be added in one go. */
  selectCandidate(rootPath: string): void;
  selectAllCandidates(): void;
  clearSelectedCandidates(): void;
  submit(): Promise<boolean>;
  reset(): void;
}

export const AddProjectPresenter =
  createAbstraction<IAddProjectPresenter>("Ui/AddProjectPresenter");

export namespace AddProjectPresenter {
  export type Interface = IAddProjectPresenter;
  export type ViewModel = AddProjectVM;
}
