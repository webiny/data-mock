import { makeAutoObservable } from "mobx";
import { getStackName } from "~/shared/environments/index.js";
import type { ProjectEnvironment, ProjectStack } from "~/shared/types.js";
import { EnvironmentsRepository as Abstraction } from "./abstractions/EnvironmentsRepository.js";

class EnvironmentsRepositoryImpl implements Abstraction.Interface {
  private _byProjectId = new Map<string, ProjectEnvironment[]>();
  private _stacksByEnvironmentId = new Map<string, ProjectStack[]>();

  public constructor() {
    makeAutoObservable(this);
  }

  public getEnvironmentsByProjectId(projectId: string): ProjectEnvironment[] {
    return this._byProjectId.get(projectId) ?? [];
  }

  public setEnvironments(projectId: string, environments: ProjectEnvironment[]): void {
    this._byProjectId.set(projectId, environments);
  }

  public findByStackName(projectId: string, stackName: string): ProjectEnvironment | null {
    const environments = this._byProjectId.get(projectId) ?? [];
    return (
      environments.find(
        (environment) =>
          getStackName({ env: environment.env, variant: environment.variant }) === stackName,
      ) ?? null
    );
  }

  public getStacks(environmentId: string): ProjectStack[] {
    return this._stacksByEnvironmentId.get(environmentId) ?? [];
  }

  public setStacks(environmentId: string, stacks: ProjectStack[]): void {
    this._stacksByEnvironmentId.set(environmentId, stacks);
  }
}

export const EnvironmentsRepository = Abstraction.createImplementation({
  implementation: EnvironmentsRepositoryImpl,
  dependencies: [],
});
