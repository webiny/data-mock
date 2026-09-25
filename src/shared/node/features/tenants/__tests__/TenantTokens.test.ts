import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import type { TestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import type { ITestProject } from "~/shared/node/testing/createTestProject.js";
import { projectTenants } from "~/shared/node/db/schema.js";
import { EnvironmentContextService } from "~/shared/node/features/environments/context/abstractions/EnvironmentContextService.js";
import { ListProjectTenantsRepository } from "../list/abstractions/ListProjectTenantsRepository.js";
import { SyncProjectTenantsRepository } from "../sync/abstractions/SyncProjectTenantsRepository.js";
import { UpdateProjectTenantRepository } from "../update/abstractions/UpdateProjectTenantRepository.js";

describe("tenant API tokens", () => {
  let tc: TestContainer;
  let project: ITestProject;

  beforeEach(async () => {
    tc = createTestContainer();
    project = await createTestProject(tc, { apiToken: "main-token" });
    await tc.container.resolve(SyncProjectTenantsRepository).execute({
      projectId: project.projectId,
      environmentId: project.environmentId,
      tenants: [
        { tenantId: "root", name: "Root" },
        { tenantId: "acme", name: "Acme" },
      ],
    });
  });

  afterEach(() => tc.cleanup());

  function setToken(tenantId: string, apiToken: string | null) {
    return tc.container
      .resolve(UpdateProjectTenantRepository)
      .execute({ environmentId: project.environmentId, tenantId, apiToken });
  }

  function context(tenant?: string) {
    return tc.container
      .resolve(EnvironmentContextService)
      .execute({ environmentId: project.environmentId, tenant });
  }

  it("stores the token encrypted and lists it decrypted", async () => {
    await setToken("acme", "acme-token");

    const stored = tc.databaseClient.db.select().from(projectTenants).all();
    expect(stored.find((row) => row.tenantId === "acme")?.apiToken).not.toBe("acme-token");

    const listed = await tc.container
      .resolve(ListProjectTenantsRepository)
      .execute({ environmentId: project.environmentId });
    expect(listed.isOk() && listed.value.find((t) => t.tenantId === "acme")?.apiToken).toBe(
      "acme-token",
    );
  });

  it("fails for a tenant that was never pulled", async () => {
    const result = await setToken("ghost", "x");
    expect(result.isFail() && result.error.code).toBe("Tenant/NotFound");
  });

  it("keeps each tenant's token across a re-pull", async () => {
    await setToken("acme", "acme-token");

    await tc.container.resolve(SyncProjectTenantsRepository).execute({
      projectId: project.projectId,
      environmentId: project.environmentId,
      tenants: [
        { tenantId: "root", name: "Root" },
        { tenantId: "acme", name: "Acme Renamed" },
      ],
    });

    const result = await context("acme");
    expect(result.isOk() && result.value.apiToken).toBe("acme-token");
  });

  it("uses the environment's token for the root tenant", async () => {
    const result = await context();
    expect(result.isOk() && result.value.tenant).toBe("root");
    expect(result.isOk() && result.value.apiToken).toBe("main-token");
  });

  it("prefers the tenant's own token over the environment's", async () => {
    await setToken("root", "root-own-token");

    const result = await context("root");
    expect(result.isOk() && result.value.apiToken).toBe("root-own-token");
  });

  it("never lends the environment's token to any other tenant", async () => {
    const result = await context("acme");

    expect(result.isFail()).toBe(true);
    expect(result.isFail() && result.error.message).toContain('tenant "acme"');
  });

  it("stops using a tenant's token once it is removed", async () => {
    await setToken("acme", "acme-token");
    await setToken("acme", null);

    expect((await context("acme")).isFail()).toBe(true);
  });
});
