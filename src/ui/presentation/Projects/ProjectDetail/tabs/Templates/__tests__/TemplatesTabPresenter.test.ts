import { describe, it, expect, beforeEach, vi } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { TemplatesTabFeature } from "../feature.js";
import { TemplatesTabPresenter } from "../abstractions/TemplatesTabPresenter.js";

const navigateMock = vi.fn();
vi.mock("~/ui/features/router/Router.js", () => ({
  navigate: (path: string) => navigateMock(path),
}));

const TEMPLATES_PATH = "/api/projects/:projectId/templates";
const DELETE_TEMPLATE_PATH = "/api/projects/:projectId/templates/:templateId";
const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID },
  envName: "dev",
  tenant: "root",
};

function template(id: string) {
  return {
    id,
    projectId: PROJECT_ID,
    name: `Template ${id}`,
    config: { tenant: "root", models: [{ modelId: "m1", amount: 3 }] },
    createdAt: 1,
  };
}

describe("TemplatesTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: TemplatesTabPresenter.Interface;

  beforeEach(() => {
    navigateMock.mockClear();
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    TemplatesTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    http.data.set(TEMPLATES_PATH, [template("t1")]);
    presenter = TemplatesTabFeature.resolve(container).presenter;
  });

  it("reads as soon as the project id is known, without waiting for an environment", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.templates.length));

    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(1);
    expect(seen.at(-1)).toBe(1);
    expect(presenter.vm.templates[0]?.id).toBe("t1");
    stop();
  });

  it("reads once for the same project", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.calls.filter((call) => call.path === TEMPLATES_PATH)).toHaveLength(1);
  });

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(TEMPLATES_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.templates).toEqual([]);

    http.failures.delete(TEMPLATES_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.templates).toHaveLength(1);
  });

  it("navigates to the seed config route when loading a template", async () => {
    await presenter.activate(CONTEXT);

    presenter.loadTemplate("t1");

    expect(navigateMock).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/env/dev/seed`);
  });

  it("does nothing when asked to load a template before any context has arrived", () => {
    presenter.loadTemplate("t1");

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("deletes a template and removes it from the list", async () => {
    await presenter.activate(CONTEXT);
    expect(presenter.vm.templates).toHaveLength(1);

    await presenter.deleteTemplate("t1");

    expect(http.calls.some((call) => call.path === DELETE_TEMPLATE_PATH)).toBe(true);
    expect(presenter.vm.templates).toEqual([]);
  });

  it("does nothing when asked to delete a template without a resolved environment", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });
    const before = http.calls.length;

    await presenter.deleteTemplate("t1");

    expect(http.calls).toHaveLength(before);
  });
});
