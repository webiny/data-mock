import { makeAutoObservable, runInAction } from "mobx";
import { CreateProjectUseCase } from "./useCases/CreateProject/abstractions/CreateProjectUseCase.js";
import { FileSystemGateway } from "~/ui/features/filesystem/abstractions/FileSystemGateway.js";
import { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { AddProjectPresenter as Abstraction } from "./abstractions/AddProjectPresenter.js";
import { createProjectBodySchema } from "~/shared/responses/projects.js";
import type {
  AddProjectMode,
  AddProjectVM,
  ScanCandidateVM,
} from "./abstractions/AddProjectPresenter.js";
import type { BrowseResult, ProjectCandidate, ScanError, ScanRoot } from "~/shared/types.js";

const DEFAULT_OPERATIONS_VERSION = "6.0.0";

/** The last segment of a path, used to name a project after the folder it lives in. */
function basename(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  const index = trimmed.lastIndexOf("/");
  return index === -1 ? trimmed : trimmed.slice(index + 1);
}

class AddProjectPresenterImpl implements Abstraction.Interface {
  private _mode: AddProjectMode = "scan";
  private _name = "";
  private _rootPath = "";
  /** True once the user edits the name, after which a new path stops overwriting it. */
  private _nameTouched = false;

  private _browse: BrowseResult | null = null;
  private _isBrowsing = false;

  private _scanRoots: ScanRoot[] = [];
  private _newScanRootPath = "";
  private _candidates: ProjectCandidate[] = [];
  /**
   * Scan mode picks any number of checkouts. The other three modes name exactly one, so they keep
   * using `_rootPath` — a scan that quietly wrote into it would make "add these five" look like
   * "add the last one you clicked".
   */
  private _selectedRootPaths: string[] = [];
  private _scanErrors: ScanError[] = [];
  private _isScanning = false;
  private _hasScanned = false;

  private _apiUrl = "";
  private _apiToken = "";
  private _tenant = "root";
  private _webinyVersion = DEFAULT_OPERATIONS_VERSION;

  private _isSubmitting = false;
  private _error: string | null = null;

  public constructor(
    private readonly createProjectUseCase: CreateProjectUseCase.Interface,
    private readonly fileSystemGateway: FileSystemGateway.Interface,
    private readonly environmentsGateway: EnvironmentsGateway.Interface,
    private readonly notificationService: NotificationService.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): AddProjectVM {
    return {
      mode: this._mode,
      name: this._name,
      rootPath: this._rootPath,

      browsePath: this._browse?.path ?? "",
      browseParentPath: this._browse?.parentPath ?? null,
      browseEntries: this._browse?.entries ?? [],
      browseIsWebinyProject: this._browse?.isWebinyProject ?? false,
      isBrowsing: this._isBrowsing,

      scanRoots: this._scanRoots.map((root) => ({ id: root.id, path: root.path })),
      newScanRootPath: this._newScanRootPath,
      candidates: this._candidates.map((candidate) => this.toCandidateVM(candidate)),
      selectedCount: this._selectedRootPaths.length,
      selectableCount: this._candidates.filter((candidate) => !candidate.registered).length,
      scanErrors: this._scanErrors,
      isScanning: this._isScanning,
      hasScanned: this._hasScanned,

      apiUrl: this._apiUrl,
      apiToken: this._apiToken,
      tenant: this._tenant,
      webinyVersion: this._webinyVersion,

      isSubmitting: this._isSubmitting,
      error: this._error,
      canSubmit: this.canSubmit,
    };
  }

  public setMode = (mode: AddProjectMode): void => {
    this._mode = mode;
    this._error = null;

    if (mode === "browse" && this._browse === null) {
      void this.browse();
    }
    if (mode === "scan" && this._scanRoots.length === 0 && !this._hasScanned) {
      void this.loadScanRoots();
    }
  };

  public setName = (value: string): void => {
    this._name = value;
    this._nameTouched = true;
    this._error = null;
  };

  public setRootPath = (value: string): void => {
    this._rootPath = value;
    this.applyDerivedName(value);
    this._error = null;
  };

  public setApiUrl = (value: string): void => {
    this._apiUrl = value;
    this._error = null;
  };

  public setApiToken = (value: string): void => {
    this._apiToken = value;
    this._error = null;
  };

  public setTenant = (value: string): void => {
    this._tenant = value;
  };

  public setWebinyVersion = (value: string): void => {
    this._webinyVersion = value;
  };

  public browse = async (path?: string): Promise<void> => {
    this._isBrowsing = true;
    this._error = null;
    try {
      const result = await this.fileSystemGateway.browse(path);
      runInAction(() => {
        if (result.isFail()) {
          this._error = result.error.message;
          return;
        }
        this._browse = result.value;
      });
    } finally {
      runInAction(() => {
        this._isBrowsing = false;
      });
    }
  };

  public browseUp = async (): Promise<void> => {
    const parent = this._browse?.parentPath;
    if (parent === null || parent === undefined) {
      return;
    }
    await this.browse(parent);
  };

  public chooseBrowsedDirectory = (): void => {
    const path = this._browse?.path;
    if (path === undefined) {
      return;
    }
    this._rootPath = path;
    this.applyDerivedName(path);
  };

  public setNewScanRootPath = (value: string): void => {
    this._newScanRootPath = value;
    this._error = null;
  };

  public loadScanRoots = async (): Promise<void> => {
    const result = await this.fileSystemGateway.listScanRoots();
    runInAction(() => {
      if (result.isFail()) {
        /**
         * Said out loud: `addScanRoot` reloads this list, so a silent failure here made a root that
         * was added successfully look as though it had not been.
         */
        this._error = result.error.message;
        return;
      }
      this._scanRoots = result.value;
    });
  };

  public addScanRoot = async (): Promise<void> => {
    const path = this._newScanRootPath.trim();
    if (path === "") {
      return;
    }

    const result = await this.fileSystemGateway.addScanRoot(path);
    if (result.isFail()) {
      runInAction(() => {
        this._error = result.error.message;
      });
      return;
    }

    runInAction(() => {
      this._newScanRootPath = "";
    });
    await this.loadScanRoots();
    await this.scan();
  };

  public removeScanRoot = async (id: string): Promise<void> => {
    const result = await this.fileSystemGateway.removeScanRoot(id);
    if (result.isFail()) {
      runInAction(() => {
        this._error = result.error.message;
      });
      return;
    }
    await this.loadScanRoots();
  };

  public scan = async (): Promise<void> => {
    this._isScanning = true;
    this._error = null;
    try {
      const result = await this.fileSystemGateway.scan();
      runInAction(() => {
        if (result.isFail()) {
          this._error = result.error.message;
          return;
        }
        /**
         * No roots is not the same answer as nothing found. The panel reported both as "No Webiny
         * projects found under those roots", which blamed folders that were never added — exactly
         * what happens after a mistyped path fails to be added as a root.
         */
        if (result.value.rootsScanned === 0) {
          this._error = "Add a folder to scan first.";
          this._candidates = [];
          this._scanErrors = [];
          this._hasScanned = false;
          return;
        }

        this._candidates = result.value.candidates;
        this._scanErrors = result.value.errors;
        this._hasScanned = true;
      });
    } finally {
      runInAction(() => {
        this._isScanning = false;
      });
    }
  };

  /** Toggles one checkout in or out of the set to add. */
  public selectCandidate = (rootPath: string): void => {
    const candidate = this._candidates.find((item) => item.rootPath === rootPath);
    // A registered checkout is shown but not selectable — adding it again would create a second
    // project for the same folder.
    if (candidate === undefined || candidate.registered) {
      return;
    }

    this._selectedRootPaths = this._selectedRootPaths.includes(rootPath)
      ? this._selectedRootPaths.filter((path) => path !== rootPath)
      : [...this._selectedRootPaths, rootPath];

    this._error = null;
    this.applyScanName();
  };

  public selectAllCandidates = (): void => {
    this._selectedRootPaths = this._candidates
      .filter((candidate) => !candidate.registered)
      .map((candidate) => candidate.rootPath);
    this._error = null;
    this.applyScanName();
  };

  public clearSelectedCandidates = (): void => {
    this._selectedRootPaths = [];
    this.applyScanName();
  };

  /**
   * One selected checkout may be renamed before it is added, so its folder name is offered as the
   * default. Several cannot share one name, so each takes its own folder's — and the name field
   * stops being offered.
   */
  private applyScanName(): void {
    const only = this._selectedRootPaths.length === 1 ? this._selectedRootPaths[0] : undefined;
    if (only === undefined) {
      return;
    }
    this.applyDerivedName(only);
  }

  public submit = async (): Promise<boolean> => {
    if (this._mode === "scan") {
      return this.submitScanned();
    }

    const body =
      this._mode === "remote"
        ? {
            name: this._name.trim(),
            apiUrl: this._apiUrl.trim(),
            apiToken: this._apiToken.trim(),
            tenant: this._tenant.trim() || "root",
            operationsVersion: this._webinyVersion.trim() || DEFAULT_OPERATIONS_VERSION,
          }
        : { name: this._name.trim(), rootPath: this._rootPath.trim() };

    const parsed = createProjectBodySchema.safeParse(body);

    if (!parsed.success) {
      this._error = parsed.error.issues[0]?.message ?? "Invalid input";
      return false;
    }

    this._isSubmitting = true;
    this._error = null;

    try {
      const added = await this.addOne(parsed.data, this._name.trim());
      if (added === null) {
        return false;
      }

      this.reset();
      return true;
    } finally {
      runInAction(() => {
        this._isSubmitting = false;
      });
    }
  };

  /**
   * Adds every checkout ticked in the scan list.
   *
   * One request per project rather than one batch: a checkout that cannot be registered — a name
   * already taken, a folder that moved — must not stop the rest, which is the whole point of
   * picking several at once.
   */
  private async submitScanned(): Promise<boolean> {
    const paths = this._selectedRootPaths;
    if (paths.length === 0) {
      this._error = "Select at least one project.";
      return false;
    }

    this._isSubmitting = true;
    this._error = null;

    try {
      const failures: string[] = [];
      let addedCount = 0;

      for (const rootPath of paths) {
        // A single pick may be renamed before it is added; several each take their folder's name.
        const name = paths.length === 1 ? this._name.trim() : basename(rootPath);
        const parsed = createProjectBodySchema.safeParse({ name, rootPath });

        if (!parsed.success) {
          failures.push(`${basename(rootPath)}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
          continue;
        }

        const added = await this.addOne(parsed.data, name, { quiet: paths.length > 1 });
        if (added === null) {
          failures.push(`${name}: ${this._error ?? "could not be added"}`);
          continue;
        }
        addedCount += 1;
      }

      if (paths.length > 1 && addedCount > 0) {
        this.notificationService.success(`${addedCount} project(s) added. Syncing from disk...`);
      }

      if (failures.length > 0) {
        runInAction(() => {
          this._error = failures.join("; ");
        });
        // Whatever did go in stays in; the dialog holds so the rest can be seen.
        return false;
      }

      this.reset();
      return true;
    } finally {
      runInAction(() => {
        this._isSubmitting = false;
      });
    }
  }

  /**
   * Creates one project and starts its sync. Returns null when it could not be created, having set
   * the error.
   *
   * A freshly registered checkout has no version, environments or stack output until it is synced,
   * so it would otherwise land in the list as an empty row. The sync is fire and forget: it is
   * enqueued as a job and reports through the job feed like any other.
   */
  private async addOne(
    body: CreateProjectUseCase.Input,
    name: string,
    options: { quiet?: boolean } = {},
  ): Promise<string | null> {
    const result = await this.createProjectUseCase.execute(body);

    if (result.isFail()) {
      runInAction(() => {
        this._error = result.error.message;
      });
      if (options.quiet !== true) {
        this.notificationService.error(`Failed to add project: ${result.error.message}`);
      }
      return null;
    }

    if (result.value.rootPath === null) {
      if (options.quiet !== true) {
        this.notificationService.success(`Project "${name}" added.`);
      }
      return result.value.id;
    }

    const synced = await this.environmentsGateway.sync(result.value.id);
    if (options.quiet !== true) {
      // The project is added either way; only the follow-up sync is in doubt.
      this.notificationService.success(
        synced.isOk()
          ? `Project "${name}" added. Syncing from disk...`
          : `Project "${name}" added, but the sync could not be started. Run it from the project.`,
      );
    }

    return result.value.id;
  }

  public reset = (): void => {
    this._mode = "scan";
    this._name = "";
    this._rootPath = "";
    this._nameTouched = false;
    this._browse = null;
    this._isBrowsing = false;
    this._newScanRootPath = "";
    this._candidates = [];
    this._selectedRootPaths = [];
    this._scanErrors = [];
    this._isScanning = false;
    this._hasScanned = false;
    this._apiUrl = "";
    this._apiToken = "";
    this._tenant = "root";
    this._webinyVersion = DEFAULT_OPERATIONS_VERSION;
    this._isSubmitting = false;
    this._error = null;
  };

  private get canSubmit(): boolean {
    if (this._mode === "scan") {
      // Several checkouts each take their folder's name, so only a single pick needs one typed.
      return (
        this._selectedRootPaths.length > 1 ||
        (this._selectedRootPaths.length === 1 && this._name.trim() !== "")
      );
    }
    if (this._name.trim() === "") {
      return false;
    }
    if (this._mode === "remote") {
      return this._apiUrl.trim() !== "" && this._apiToken.trim() !== "";
    }
    return this._rootPath.trim() !== "";
  }

  /** The folder name is a good default, but never overwrites a name the user typed. */
  private applyDerivedName(path: string): void {
    if (this._nameTouched) {
      return;
    }
    this._name = basename(path);
  }

  private toCandidateVM(candidate: ProjectCandidate): ScanCandidateVM {
    return {
      rootPath: candidate.rootPath,
      name: candidate.name,
      versionLabel:
        candidate.webinyVersion !== null
          ? `v${candidate.webinyVersion}`
          : candidate.versionMajor !== null
            ? `v${candidate.versionMajor} workspace root`
            : "not a Webiny project",
      registered: candidate.registered,
      selected: this._selectedRootPaths.includes(candidate.rootPath),
    };
  }
}

export const AddProjectPresenter = Abstraction.createImplementation({
  implementation: AddProjectPresenterImpl,
  dependencies: [CreateProjectUseCase, FileSystemGateway, EnvironmentsGateway, NotificationService],
});
