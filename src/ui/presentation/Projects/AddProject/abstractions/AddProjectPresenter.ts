import { createAbstraction } from "@webiny/stdlib";

export interface AddProjectVM {
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant: string;
  webinyVersion: string;
  isSubmitting: boolean;
  error: string | null;
}

export interface IAddProjectPresenter {
  readonly vm: AddProjectVM;
  setName(value: string): void;
  setApiUrl(value: string): void;
  setApiToken(value: string): void;
  setTenant(value: string): void;
  setWebinyVersion(value: string): void;
  submit(): Promise<boolean>;
  reset(): void;
}

export const AddProjectPresenter =
  createAbstraction<IAddProjectPresenter>("Ui/AddProjectPresenter");

export namespace AddProjectPresenter {
  export type Interface = IAddProjectPresenter;
  export type ViewModel = AddProjectVM;
}
