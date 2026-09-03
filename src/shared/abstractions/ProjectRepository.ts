import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "../types.js";
import type { ProjectNotFoundError, ProjectPersistenceError } from "../errors.js";

export interface IProjectCreateInput {
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant?: string;
}

export interface IProjectRepository {
  list(): Promise<Result<Project[], ProjectPersistenceError>>;
  getById(id: string): Promise<Result<Project, ProjectNotFoundError | ProjectPersistenceError>>;
  create(input: ProjectRepository.CreateInput): Promise<Result<Project, ProjectPersistenceError>>;
  remove(id: string): Promise<Result<void, ProjectNotFoundError | ProjectPersistenceError>>;
}

export const ProjectRepository = createAbstraction<IProjectRepository>("Shared/ProjectRepository");

export namespace ProjectRepository {
  export type Interface = IProjectRepository;
  export type Record = Project;
  export type CreateInput = IProjectCreateInput;
  export type NotFoundError = ProjectNotFoundError;
  export type PersistenceError = ProjectPersistenceError;
}
