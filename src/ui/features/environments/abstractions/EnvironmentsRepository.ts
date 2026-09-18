import { createAbstraction } from "@webiny/stdlib";
import type { ProjectEnvironment, ProjectStack } from "~/shared/types.js";

export interface IEnvironmentsRepository {
  getEnvironmentsByProjectId(projectId: string): ProjectEnvironment[];
  setEnvironments(projectId: string, environments: ProjectEnvironment[]): void;
  /** Resolves a stack name (`dev`, `dev___blue`) within a project. */
  findByStackName(projectId: string, stackName: string): ProjectEnvironment | null;
  getStacks(environmentId: string): ProjectStack[];
  setStacks(environmentId: string, stacks: ProjectStack[]): void;
}

export const EnvironmentsRepository = createAbstraction<IEnvironmentsRepository>(
  "Ui/EnvironmentsRepository",
);

export namespace EnvironmentsRepository {
  export type Interface = IEnvironmentsRepository;
}
