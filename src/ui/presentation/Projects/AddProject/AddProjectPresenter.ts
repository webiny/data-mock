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

  public selectCandidate = (rootPath: string): void => {
    const candidate = this._candidates.find((item) => item.rootPath === rootPath);
    // A registered checkout is shown but not selectable — adding it again would create a second
    // project for the same folder.
    if (candidate === undefined || candidate.registered) {
      return;
    }
    this._rootPath = candidate.rootPath;
    this.applyDerivedName(candidate.rootPath);
  };

  public submit = async (): Promise<boolean> => {
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
      const result = await this.createProjectUseCase.execute(parsed.data);

      if (result.isFail()) {
        runInAction(() => {
          this._error = result.error.message;
        });
        this.notificationService.error(`Failed to add project: ${result.error.message}`);
        return false;
      }

      const name = this._name;

      /**
       * A freshly registered checkout has no version, environments or stack output until it is
       * synced, so the project would land in the list as an empty row. Syncing here is fire and
       * forget: it is enqueued as a job and reports through the job feed like any other.
       */
      if (result.value.rootPath !== null) {
        const synced = await this.environmentsGateway.sync(result.value.id);
        // The project is added either way; only the follow-up sync is in doubt.
        this.notificationService.success(
          synced.isOk()
            ? `Project "${name}" added. Syncing from disk...`
            : `Project "${name}" added, but the sync could not be started. Run it from the project.`,
        );
      } else {
        this.notificationService.success(`Project "${name}" added.`);
      }

      this.reset();
      return true;
    } finally {
      runInAction(() => {
        this._isSubmitting = false;
      });
    }
  };

  public reset = (): void => {
    this._mode = "scan";
    this._name = "";
    this._rootPath = "";
    this._nameTouched = false;
    this._browse = null;
    this._isBrowsing = false;
    this._newScanRootPath = "";
    this._candidates = [];
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
      selected: this._rootPath === candidate.rootPath,
    };
  }
}

export const AddProjectPresenter = Abstraction.createImplementation({
  implementation: AddProjectPresenterImpl,
  dependencies: [CreateProjectUseCase, FileSystemGateway, EnvironmentsGateway, NotificationService],
});
