import { makeAutoObservable, runInAction } from "mobx";

export interface IActionConfirmationVM {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** True while the confirmed action runs. The dialog stays open and cannot be dismissed. */
  isSubmitting: boolean;
}

export interface IConfirmableAction {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
}

/**
 * One confirmation dialog for every action that starts a job.
 *
 * A deploy, a destroy, a sync from disk and a pull all reach outside this tool: they spawn the
 * project's own CLI, or write to a live CMS. None of them is undoable from here, and each was a
 * single click away, so a misread button tore down a stack or started a twenty-minute run against
 * the wrong environment.
 *
 * The state lives in a presenter rather than in a component so that the dialog's copy is decided
 * where the action is — the environment, the app list and the project name are what make the
 * warning specific, and a generic "Are you sure?" would not be worth the extra click.
 */
export class ActionConfirmation {
  private _pending: IConfirmableAction | null = null;
  private _isSubmitting = false;

  public constructor() {
    makeAutoObservable(this);
  }

  public get vm(): IActionConfirmationVM {
    const pending = this._pending;

    return {
      isOpen: pending !== null,
      title: pending?.title ?? "",
      message: pending?.message ?? "",
      confirmLabel: pending?.confirmLabel ?? "",
      isSubmitting: this._isSubmitting,
    };
  }

  public request = (action: IConfirmableAction): void => {
    this._pending = action;
  };

  /** Ignored while the action runs: closing then would leave it running with nothing reporting it. */
  public cancel = (): void => {
    if (this._isSubmitting) {
      return;
    }
    this._pending = null;
  };

  public confirm = async (): Promise<void> => {
    const pending = this._pending;
    if (pending === null || this._isSubmitting) {
      return;
    }

    this._isSubmitting = true;
    try {
      await pending.run();
    } finally {
      runInAction(() => {
        this._isSubmitting = false;
        this._pending = null;
      });
    }
  };
}
