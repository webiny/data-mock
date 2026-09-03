import { Result, Logger } from "@webiny/stdlib";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { VerifyProjectAccessService as Abstraction } from "./abstractions/VerifyProjectAccessService.js";
import { GraphQLRequestError } from "~/shared/errors.js";

class VerifyProjectAccessServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly httpClient: HttpClient.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    const query = `{ cms { listContentModelGroups { data { id name } } } }`;

    try {
      const response = await this.httpClient.post(`${input.apiUrl}`, JSON.stringify({ query }), {
        "Content-Type": "application/json",
        authorization: `Bearer ${input.apiToken}`,
        "x-tenant": input.tenant,
      });

      if (response.status !== 200) {
        const text = await response.text().catch(() => "");
        return Result.fail(
          new GraphQLRequestError(
            `API access verification failed with status ${response.status}`,
            response.status,
            text,
          ),
        );
      }

      const json = (await response.json()) as {
        data?: unknown;
        errors?: Array<{ message: string }>;
      };

      if (json.errors && json.errors.length > 0) {
        return Result.fail(
          new GraphQLRequestError(json.errors[0]?.message ?? "API access verification failed", 200),
        );
      }

      this.logger.info("API access verified successfully.");
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new GraphQLRequestError(
          error instanceof Error ? error.message : "API access verification failed",
          0,
        ),
      );
    }
  }
}

export const VerifyProjectAccessService = Abstraction.createImplementation({
  implementation: VerifyProjectAccessServiceImpl,
  dependencies: [HttpClient, Logger],
});
