import { makeAutoObservable, runInAction } from "mobx";
import { CreateProjectUseCase } from "./useCases/CreateProject/abstractions/CreateProjectUseCase.js";
import { AddProjectPresenter as Abstraction } from "./abstractions/AddProjectPresenter.js";
import { createProjectBodySchema } from "~/shared/responses/projects.js";
import type { AddProjectVM } from "./abstractions/AddProjectPresenter.js";

class AddProjectPresenterImpl implements Abstraction.Interface {
  private _name = "";
  private _apiUrl = "";
  private _apiToken = "";
  private _tenant = "root";
  private _webinyVersion = "6.0.0";
  private _isSubmitting = false;
  private _error: string | null = null;

  public constructor(private readonly createProjectUseCase: CreateProjectUseCase.Interface) {
    makeAutoObservable(this);
  }

  public get vm(): AddProjectVM {
    return {
      name: this._name,
      apiUrl: this._apiUrl,
      apiToken: this._apiToken,
      tenant: this._tenant,
      webinyVersion: this._webinyVersion,
      isSubmitting: this._isSubmitting,
      error: this._error,
    };
  }

  public setName = (value: string): void => {
    this._name = value;
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

  public submit = async (): Promise<boolean> => {
    const parsed = createProjectBodySchema.safeParse({
      name: this._name.trim(),
      apiUrl: this._apiUrl.trim(),
      apiToken: this._apiToken.trim(),
      tenant: this._tenant.trim() || "root",
      webinyVersion: this._webinyVersion.trim() || "6.0.0",
    });

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

  public reset = (): void => {
    this._name = "";
    this._apiUrl = "";
    this._apiToken = "";
    this._tenant = "root";
    this._webinyVersion = "6.0.0";
    this._isSubmitting = false;
    this._error = null;
  };
}

export const AddProjectPresenter = Abstraction.createImplementation({
  implementation: AddProjectPresenterImpl,
  dependencies: [CreateProjectUseCase],
});
