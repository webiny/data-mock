import { Logger } from "@webiny/stdlib";
import { JobExecutionContextFactory as Abstraction } from "./abstractions/JobExecutionContextFactory.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "~/shared/node/websocket/abstractions/WebSocketBroadcaster.js";
import { JobExecutionContext } from "./JobExecutionContext.js";

class JobExecutionContextFactoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public create(input: Abstraction.Input): Abstraction.Context {
    return new JobExecutionContext(
      input.jobId,
      input.projectId,
      this.databaseClient,
      this.webSocketBroadcaster,
      this.logger,
    );
  }
}

export const JobExecutionContextFactory = Abstraction.createImplementation({
  implementation: JobExecutionContextFactoryImpl,
  dependencies: [DatabaseClient, WebSocketBroadcaster, Logger],
});
