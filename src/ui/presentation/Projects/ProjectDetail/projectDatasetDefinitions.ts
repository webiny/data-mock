/**
 * Reports a dataset that could not be read, and says whether that happened. The dataset stays
 * unloaded, so opening the tab again tries once more.
 */
function reportFailure(
  notifications: NotificationService.Interface,
): <TValue, TError extends { message: string }>(
  dataset: string,
  result: Result<TValue, TError>,
) => boolean {
  return (dataset, result) => {
    if (!result.isFail()) {
      return false;
    }
    notifications.error(`Could not load ${dataset}: ${result.error.message}`);
    return true;
  };
}

import { runInAction } from "mobx";
import type { Result } from "@webiny/stdlib";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import type { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import type { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import type { EnvironmentsRepository } from "~/ui/features/environments/abstractions/EnvironmentsRepository.js";
import type { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import type { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import type { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import type { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import type { FilesGateway } from "~/ui/features/files/abstractions/FilesGateway.js";
import type { FilesRepository } from "~/ui/features/files/abstractions/FilesRepository.js";
import type { LocalFilesGateway } from "~/ui/features/localFiles/abstractions/LocalFilesGateway.js";
import type { LocalFilesRepository } from "~/ui/features/localFiles/abstractions/LocalFilesRepository.js";
import type { EntriesGateway } from "~/ui/features/entries/abstractions/EntriesGateway.js";
import type { EntriesRepository } from "~/ui/features/entries/abstractions/EntriesRepository.js";
import type { SeedingGateway } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import type { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import type { TemplatesGateway } from "~/ui/features/templates/abstractions/TemplatesGateway.js";
import type { TemplatesRepository } from "~/ui/features/templates/abstractions/TemplatesRepository.js";
import type { SyncLogsGateway } from "~/ui/features/syncLogs/abstractions/SyncLogsGateway.js";
import type { SyncLogsRepository } from "~/ui/features/syncLogs/abstractions/SyncLogsRepository.js";
import type { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import type { JobsRepository } from "~/ui/features/jobs/abstractions/JobsRepository.js";
import type { IDatasetDefinition } from "./ProjectDatasets.js";

/** The four paged lists, whose page, filters and sort go into the request. */
export interface IListStates {
  entries: URLListState.Interface;
  seedJobs: URLListState.Interface;
  syncLogs: URLListState.Interface;
  jobs: URLListState.Interface;
}

/**
 * Everything the readers need. It is the whole gateway-and-repository half of the project detail
 * presenter, which is why it is worth having somewhere other than in the presenter.
 */
export interface IProjectDatasetDeps {
  listStates: IListStates;
  notifications: NotificationService.Interface;
  environmentsGateway: EnvironmentsGateway.Interface;
  environmentsRepository: EnvironmentsRepository.Interface;
  tenantsGateway: TenantsGateway.Interface;
  tenantsRepository: TenantsRepository.Interface;
  modelsGateway: ModelsGateway.Interface;
  modelsRepository: ModelsRepository.Interface;
  filesGateway: FilesGateway.Interface;
  filesRepository: FilesRepository.Interface;
  localFilesGateway: LocalFilesGateway.Interface;
  localFilesRepository: LocalFilesRepository.Interface;
  entriesGateway: EntriesGateway.Interface;
  entriesRepository: EntriesRepository.Interface;
  seedingGateway: SeedingGateway.Interface;
  seedingRepository: SeedingRepository.Interface;
  templatesGateway: TemplatesGateway.Interface;
  templatesRepository: TemplatesRepository.Interface;
  syncLogsGateway: SyncLogsGateway.Interface;
  syncLogsRepository: SyncLogsRepository.Interface;
  jobsGateway: JobsGateway.Interface;
  jobsRepository: JobsRepository.Interface;
}

function buildJobsParams(listStates: IListStates): Record<string, string | number> {
  const params: Record<string, string | number> = { page: listStates.jobs.page };
  const type = listStates.jobs.get("jobType");
  const status = listStates.jobs.get("jobStatus");
  if (type) {
    params.type = type;
  }
  if (status) {
    params.status = status;
  }
  const sort = listStates.jobs.sort;
  if (sort) {
    params.sortField = sort.field;
    params.sortDir = sort.direction;
  }
  return params;
}

function buildSeedJobsParams(listStates: IListStates): Record<string, string | number> {
  const params: Record<string, string | number> = { page: listStates.seedJobs.page };
  const status = listStates.seedJobs.get("seedStatus");
  if (status) {
    params.status = status;
  }
  return params;
}

function buildSyncLogsParams(listStates: IListStates): Record<string, string | number> {
  const params: Record<string, string | number> = { page: listStates.syncLogs.page };
  const type = listStates.syncLogs.get("logType");
  const status = listStates.syncLogs.get("logStatus");
  if (type) {
    params.type = type;
  }
  if (status) {
    params.status = status;
  }
  return params;
}

function buildEntriesParams(listStates: IListStates): Record<string, string | number> {
  const params: Record<string, string | number> = { page: listStates.entries.page };
  const jobId = listStates.entries.get("jobId");
  const modelId = listStates.entries.get("modelId");
  const tenant = listStates.entries.get("tenant");
  const status = listStates.entries.get("status");
  if (jobId) {
    params.jobId = jobId;
  }
  if (modelId) {
    params.modelId = modelId;
  }
  if (tenant) {
    params.tenant = tenant;
  }
  if (status) {
    params.status = status;
  }
  return params;
}

/**
 * One reader per tab: read, report a failure, store. Each returns whether anything was stored,
 * which is what decides if the dataset counts as loaded — see `ProjectDatasets`.
 */
export function buildProjectDatasets(
  deps: IProjectDatasetDeps,
): Record<string, IDatasetDefinition> {
  const { listStates } = deps;
  const failed = reportFailure(deps.notifications);
  return {
    tenants: {
      scope: "environment",
      read: async (ref) => {
        const result = await deps.tenantsGateway.listForProject(ref);
        if (failed("tenants", result)) {
          return false;
        }
        runInAction(() => deps.tenantsRepository.setTenants(ref.environmentId, result.value));
        return true;
      },
    },
    models: {
      scope: "environment",
      read: async (ref) => {
        const result = await deps.modelsGateway.listModels(ref);
        if (failed("models", result)) {
          return false;
        }
        runInAction(() => deps.modelsRepository.setModels(result.value));
        return true;
      },
    },
    files: {
      scope: "environment",
      read: async (ref) => {
        const [files, localFiles] = await Promise.all([
          deps.filesGateway.list(ref),
          deps.localFilesGateway.list(),
        ]);
        if (failed("files", files) || failed("files", localFiles)) {
          return false;
        }
        runInAction(() => {
          deps.filesRepository.setFiles(files.value);
          deps.localFilesRepository.setFiles(localFiles.value);
        });
        return true;
      },
    },
    entries: {
      scope: "environment",
      read: async (ref) => {
        const result = await deps.entriesGateway.list(ref, buildEntriesParams(listStates));
        if (failed("entries", result)) {
          return false;
        }
        runInAction(() =>
          deps.entriesRepository.setEntries(result.value.entries, result.value.total),
        );
        return true;
      },
    },
    seedJobs: {
      scope: "environment",
      read: async (ref) => {
        const result = await deps.seedingGateway.listSeedJobs(ref, buildSeedJobsParams(listStates));
        if (failed("seedJobs", result)) {
          return false;
        }
        runInAction(() =>
          deps.seedingRepository.setSeedJobs(result.value.seedJobs, result.value.total),
        );
        return true;
      },
    },
    templates: {
      scope: "project",
      read: async (projectId) => {
        const result = await deps.templatesGateway.listForProject(projectId);
        if (failed("templates", result)) {
          return false;
        }
        runInAction(() => deps.templatesRepository.setTemplates(result.value));
        return true;
      },
    },
    syncLogs: {
      scope: "environment",
      read: async (ref) => {
        const result = await deps.syncLogsGateway.list(ref, buildSyncLogsParams(listStates));
        if (failed("syncLogs", result)) {
          return false;
        }
        runInAction(() => deps.syncLogsRepository.setLogs(result.value.logs, result.value.total));
        return true;
      },
    },
    stacks: {
      scope: "environment",
      read: async (ref) => {
        const result = await deps.environmentsGateway.listStacks(ref.projectId, ref.environmentId);
        if (failed("stacks", result)) {
          return false;
        }
        runInAction(() => deps.environmentsRepository.setStacks(ref.environmentId, result.value));
        return true;
      },
    },
    environments: {
      // A sync can add, remove or redeploy environments, so the list itself is read again — not
      // just the stacks hanging off the one currently selected. Archived rows are listed too, so
      // they stay visible with a Restore next to them instead of vanishing from the tab that
      // just archived them.
      scope: "project",
      read: async (projectId) => {
        const result = await deps.environmentsGateway.listForProject(projectId, true);
        if (failed("environments", result)) {
          return false;
        }
        runInAction(() => deps.environmentsRepository.setEnvironments(projectId, result.value));
        return true;
      },
    },
    jobs: {
      scope: "project",
      read: async (projectId) => {
        const result = await deps.jobsGateway.list(projectId, buildJobsParams(listStates));
        if (failed("jobs", result)) {
          return false;
        }
        runInAction(() => deps.jobsRepository.setJobs(result.value.jobs, result.value.total));
        return true;
      },
    },
  };
}
