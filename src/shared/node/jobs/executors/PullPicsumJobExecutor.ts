import { PullPicsumJobExecutor as Abstraction } from "./abstractions/PullPicsumJobExecutor.js";
import { PullPicsumImagesService } from "~/shared/node/features/files/picsum/abstractions/PullPicsumImagesService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

interface IPullPicsumJobConfig {
  count: number;
  width?: number;
  height?: number;
}

const DEFAULT_COUNT = 10;

class PullPicsumJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "pull-picsum";

  public constructor(private readonly picsumService: PullPicsumImagesService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const config: IPullPicsumJobConfig = context.configJson
      ? (JSON.parse(context.configJson) as IPullPicsumJobConfig)
      : { count: DEFAULT_COUNT };
    context.appendLog(`Pulling ${config.count} picsum image(s)...`);

    const input: PullPicsumImagesService.Input = {
      count: config.count,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    };
    if (config.width !== undefined) {
      input.width = config.width;
    }
    if (config.height !== undefined) {
      input.height = config.height;
    }

    const result = await this.picsumService.execute(input);

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(`Downloaded ${result.value.downloaded} image(s).`);
  }
}

export const PullPicsumJobExecutor = Abstraction.createImplementation({
  implementation: PullPicsumJobExecutorImpl,
  dependencies: [PullPicsumImagesService],
});
