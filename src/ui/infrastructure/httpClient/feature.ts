import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClient } from "./abstractions/HTTPClient.js";
import { BaseUrl } from "./abstractions/BaseUrl.js";
import { FetchHTTPClientImpl } from "./FetchHTTPClient.js";

interface IHTTPClientFeatureContext {
  readonly baseUrl: string;
}

export const HTTPClientFeature = createFeature<IHTTPClientFeatureContext>({
  name: "Ui/HTTPClientFeature",
  register(container, context) {
    container.registerInstance(BaseUrl, { value: context.baseUrl });
    const baseUrl = container.resolve(BaseUrl);
    const client = new FetchHTTPClientImpl(baseUrl);
    container.registerInstance(HTTPClient, client);
  },
});
