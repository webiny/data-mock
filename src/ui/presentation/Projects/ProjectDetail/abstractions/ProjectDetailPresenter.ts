import { createAbstraction } from "@webiny/stdlib";
import type { StackReadState } from "~/shared/types.js";
import type { ISyncPreviewVM } from "~/ui/presentation/shared/syncPreview/SyncPreviewState.js";

export interface IProjectVM {
  id: string;
  name: string;
  rootPath: string | null;
  /** Detected version, null for a framework workspace root built from source. */
  webinyVersion: string | null;
  /** 5 or 6. Selects which raw Pulumi output keys the System Info panel reads. */
  versionMajor: number | null;
  operationsVersion: string;
  createdAt: number;
}

/** One selectable environment. `stackName` is its URL identity. */
export interface IEnvironmentVM {
  archivedAt: number | null;
  id: string;
  stackName: string;
  env: string;
  variant: string;
  region: string | null;
  deployed: boolean;
  /** False when the api app is not deployed — the environment cannot be seeded. */
  connectable: boolean;
  apiUrl: string | null;
  adminUrl: string | null;
  apiToken: string | null;
  tenant: string;
  lastSyncedAt: number | null;
}

/** One app's Pulumi stack within the selected environment. */
export interface IStackVM {
  app: string;
  deployed: boolean;
  resourceCount: number | null;
  readState: StackReadState;
  /** "Deployed", "Not deployed" or "Could not read" — an unknown read is never shown as zero. */
  stateLabel: string;
  syncedAt: number | null;
  /** Pretty-printed raw stack output, or null when the stack has none stored. */
  rawOutput: string | null;
}

export interface ISystemInfoItemVM {
  label: string;
  value: string;
}

export interface ISystemInfoSectionVM {
  title: string;
  items: ISystemInfoItemVM[];
}

/**
 * Two-step confirmation for removing an environment, in the same shape as the project one:
 * `mode` starts at "archive" — the reversible action — and only moves to "purge" once the user
 * explicitly asks, with the impact counts on screen.
 */
export interface IEnvironmentDeleteConfirmationVM {
  isOpen: boolean;
  mode: "archive" | "purge";
  environmentId: string | null;
  stackName: string | null;
  isLoadingImpact: boolean;
  impact: Array<{ label: string; count: number }>;
  impactTotal: number;
}

/**
 * Deploy and destroy share one dialog shape. `step` is what makes destroy two-step: "review"
 * states what will be torn down; "confirm" demands the project name typed back. Deploy never
 * leaves "review" and never asks for a name.
 */
export interface IDeploymentDialogVM {
  isOpen: boolean;
  command: "deploy" | "destroy";
  step: "review" | "confirm";
  stackName: string | null;
  projectName: string;
  /** Apps this project's version can deploy. Empty while it loads, or for a remote-only project. */
  deployableApps: string[];
  selectedApps: string[];
  region: string | null;
  regionOptions: Array<{ value: string; label: string }>;
  /** Deploy only: plan the change and create nothing. */
  preview: boolean;
  /** What a destroy would tear down, per app. Empty for a deploy. */
  atRisk: Array<{ app: string; resourceCount: number | null; deployed: boolean }>;
  /** Named resources a destroy would take with it, for the review step. */
  atRiskResources: Array<{ label: string; value: string }>;
  typedName: string;
  /** False until the typed name matches exactly, or immediately true for a deploy. */
  canConfirm: boolean;
  isSubmitting: boolean;
  error: string | null;
}

export interface IEditProjectInput {
  name?: string;
  rootPath?: string | null;
  operationsVersion?: string;
}

/** Connection details of one environment. A field left out keeps its stored value. */
export interface IEditEnvironmentInput {
  apiUrl?: string | null;
  apiToken?: string | null;
  tenant?: string;
}

/**
 * What the page frame around the tabs shows. Every tab owns its own presenter and its own data;
 * this one owns the project, the environment the page is pointed at, and the actions that change
 * either — which is why they stayed together rather than becoming a fifteenth tab.
 */
export interface IProjectDetailVM {
  project: IProjectVM | null;
  environments: IEnvironmentVM[];
  /** Soft-deleted environments, shown in the Environments tab with a Restore next to them. */
  archivedEnvironments: IEnvironmentVM[];
  currentEnvironment: IEnvironmentVM | null;
  stacks: IStackVM[];
  environmentDeleteConfirmation: IEnvironmentDeleteConfirmationVM;
  deploymentDialog: IDeploymentDialogVM;
  systemInfo: ISystemInfoSectionVM[];
  /** Why System Info is empty, when it is. Never left blank without a reason. */
  systemInfoNotice: string | null;
  /** Hidden when a project has a single environment, which is the common case. */
  showEnvironmentSelector: boolean;
  environmentError: string | null;
  /** Why the page is blank, when the project itself could not be read. */
  loadError: string | null;
  projectHealth: "unknown" | "checking" | "reachable" | "unreachable";
  projectHealthError: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  showEditDialog: boolean;
  /** The environment whose connection details are being edited, or null when the dialog is shut. */
  editingEnvironment: IEnvironmentVM | null;
  /** What a sync from disk would change. Shown before anything is stored. */
  syncPreview: ISyncPreviewVM;
}

export interface IProjectDetailPresenter {
  readonly vm: IProjectDetailVM;
  load(projectId: string, envName: string | null): Promise<void>;
  checkHealth(): Promise<void>;
  /** Reads the selected environment's stacks, for the Environments and System Info tabs. */
  loadStacks(): Promise<void>;
  /**
   * Reads what a sync from disk would change and opens the diff. Nothing is stored until
   * `applySync`.
   */
  syncProject(): void;
  applySync(): Promise<void>;
  closeSyncPreview(): void;
  /** Opens the confirmation in its reversible "archive" mode and loads the impact counts. */
  confirmRemoveEnvironment(environmentId: string, stackName: string): void;
  cancelRemoveEnvironment(): void;
  /** Moves the open confirmation to "purge" mode. Does not delete anything on its own. */
  requestPurgeEnvironment(): void;
  archiveEnvironment(): Promise<void>;
  purgeEnvironment(): Promise<void>;
  restoreEnvironment(environmentId: string): Promise<void>;
  /** Opens the deploy or destroy dialog for the currently selected environment. */
  openDeploymentDialog(command: "deploy" | "destroy"): void;
  closeDeploymentDialog(): void;
  toggleDeploymentApp(app: string): void;
  setDeploymentRegion(region: string | null): void;
  toggleDeploymentPreview(): void;
  /** Moves a destroy from "review" to the typed-name step. Deploy never calls this. */
  reviewDeployment(): void;
  setDeploymentTypedName(value: string): void;
  submitDeployment(): Promise<void>;
  openEditDialog(): void;
  closeEditDialog(): void;
  submitEdit(input: IEditProjectInput): Promise<boolean>;
  openEditEnvironment(environmentId: string): void;
  closeEditEnvironment(): void;
  submitEditEnvironment(input: IEditEnvironmentInput): Promise<boolean>;
  dispose(): void;
}

export const ProjectDetailPresenter = createAbstraction<IProjectDetailPresenter>(
  "Ui/ProjectDetailPresenter",
);

export namespace ProjectDetailPresenter {
  export type Interface = IProjectDetailPresenter;
  export type VM = IProjectDetailVM;
}
