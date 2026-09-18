import { getStackName } from "~/shared/environments/index.js";
import type { ProjectEnvironment } from "~/shared/types.js";
import type { Prompts } from "./Prompts.js";
import type { UI } from "./UI.js";
import { isCancelled } from "./isCancelled.js";

export interface ISelectEnvironmentResult {
  environment: ProjectEnvironment | null;
  cancelled: boolean;
}

/**
 * Picks an environment for a command to act on.
 *
 * Most projects have a single environment (`dev`), so prompting there would be a keypress that can
 * only be answered one way. With exactly one it is selected and reported; with several the user
 * chooses. Environments whose api app is not deployed are shown but marked, since selecting one
 * would fail at request time with a less obvious message.
 */
export async function selectEnvironment(
  prompts: Prompts.Interface,
  ui: UI.Interface,
  environments: ProjectEnvironment[],
): Promise<ISelectEnvironmentResult> {
  if (environments.length === 0) {
    ui.log.error("This project has no environments. Run a sync to discover them.");
    return { environment: null, cancelled: false };
  }

  const only = environments[0];
  if (environments.length === 1 && only) {
    const stackName = getStackName({ env: only.env, variant: only.variant });
    ui.log.info(`Environment: ${stackName} (only one)`);
    return { environment: only, cancelled: false };
  }

  const selected = await prompts.select<ProjectEnvironment>({
    message: "Environment",
    options: environments.map((environment) => {
      const stackName = getStackName({ env: environment.env, variant: environment.variant });
      const hint =
        environment.apiUrl === null ? "not connectable — api app not deployed" : environment.apiUrl;
      return { value: environment, label: stackName, hint };
    }),
  });

  if (isCancelled(selected)) {
    return { environment: null, cancelled: true };
  }

  return { environment: selected, cancelled: false };
}
