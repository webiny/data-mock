import { createFeature } from "~/ui/di/createFeature.js";
import { BaseUrl } from "./abstractions/BaseUrl.js";
import { FetchHTTPClient } from "./FetchHTTPClient.js";

interface IHTTPClientFeatureContext {
  readonly baseUrl: string;
}

export const HTTPClientFeature = createFeature<IHTTPClientFeatureContext>({
  name: "Ui/HTTPClientFeature",
  register(container, context) {
    container.registerInstance(BaseUrl, { value: context.baseUrl });
    container.register(FetchHTTPClient).inSingletonScope();
  },
});
