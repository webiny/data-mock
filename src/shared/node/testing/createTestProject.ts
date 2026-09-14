import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import type { Project, ProjectEnvironment } from "~/shared/types.js";
import type { TestContainer } from "./createTestContainer.js";

export interface ITestProject {
  project: Project;
  environment: ProjectEnvironment;
  /** Convenience for the many repositories that take both ids. */
  projectId: string;
  environmentId: string;
}

export interface ICreateTestProjectOptions {
  name?: string;
  apiUrl?: string;
  apiToken?: string;
  tenant?: string;
  env?: string;
}

/**
 * Creates a project and its first environment.
 *
 * Every test needs both: a project owns nothing seedable on its own, and all the env-scoped
 * repositories key off an environment id. `apiUrl` is a BASE url — operations append their own
 * "/cms/manage" path — so the default has no CMS path on it.
 */
export async function createTestProject(
  tc: TestContainer,
  options: ICreateTestProjectOptions = {},
): Promise<ITestProject> {
  const useCase = tc.container.resolve(CreateProjectUseCase);

  const result = await useCase.execute({
    name: options.name ?? "Test Project",
    apiUrl: options.apiUrl ?? "https://api.example.com",
    apiToken: options.apiToken ?? "test-token",
    tenant: options.tenant ?? "root",
    env: options.env ?? "dev",
  });

  if (result.isFail()) {
    throw new Error(`Failed to create test project: ${result.error.message}`);
  }

  const { project, environment } = result.value;

  return { project, environment, projectId: project.id, environmentId: environment.id };
}
