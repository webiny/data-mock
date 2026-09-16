import { makeAutoObservable, runInAction } from "mobx";
import type { EnvironmentRef } from "~/shared/types.js";

export interface IDatasetContext {
  projectId: string;
  /** Null until an environment has been resolved, or after the current one was purged. */
  ref: EnvironmentRef | null;
}

/**
 * A dataset that needs only the project. The environment list is one of them: it is what a purge
 * reads again after clearing the environment the page was pointed at.
 *
 * `read` stores what it read and returns whether it stored anything — false means the read failed.
 */
export interface IProjectDataset {
  scope: "project";
  read(projectId: string): Promise<boolean>;
}

/** A dataset that addresses one stack, and so waits for a resolved environment. */
export interface IEnvironmentDataset {
  scope: "environment";
  read(ref: EnvironmentRef): Promise<boolean>;
}

export type IDatasetDefinition = IProjectDataset | IEnvironmentDataset;

/**
 * The project detail page's per-tab data, loaded once each and reloaded on demand.
 *
 * Every tab used to carry its own copy of the same four steps — read, check, store, mark loaded —
 * once inside a `loadDataset` switch and again in a `reloadX` method beside it, which is how the
 * two drifted apart. There is one reader per dataset now, and loading and reloading differ only in
 * whether the "already loaded" answer counts.
 */
export class ProjectDatasets {
  private loaded = new Set<string>();
  private inFlight = new Set<string>();

  public constructor(
    private readonly definitions: Record<string, IDatasetDefinition>,
    private readonly context: () => IDatasetContext | null,
  ) {
    makeAutoObservable(this);
  }

  public isLoaded(dataset: string): boolean {
    return this.loaded.has(dataset);
  }

  /** Forgets everything, for a move to another project. */
  public clear(): void {
    runInAction(() => {
      this.loaded = new Set();
      this.inFlight = new Set();
    });
  }

  /** Reads a dataset that has not been read yet. A dataset already loading is left to finish. */
  public load = async (dataset: string): Promise<void> => {
    if (this.loaded.has(dataset) || this.inFlight.has(dataset)) {
      return;
    }
    await this.run(dataset);
  };

  public loadAll = async (datasets: readonly string[]): Promise<void> => {
    await Promise.all(datasets.map((dataset) => this.load(dataset)));
  };

  /**
   * Reads a dataset again, whether or not it is already loaded.
   *
   * Deliberately not gated on a read in flight: a reload answers a filter or a page the user has
   * just changed, and dropping it would leave the list showing the previous one.
   */
  public reload = async (dataset: string): Promise<void> => {
    runInAction(() => {
      this.loaded.delete(dataset);
    });
    await this.run(dataset);
  };

  public reloadAll = async (datasets: readonly string[]): Promise<void> => {
    await Promise.all(datasets.map((dataset) => this.reload(dataset)));
  };

  private async run(dataset: string): Promise<void> {
    const definition = this.definitions[dataset];
    const context = this.context();
    if (!definition || context === null) {
      return;
    }

    if (definition.scope === "project") {
      await this.attempt(dataset, () => definition.read(context.projectId));
      return;
    }

    const ref = context.ref;
    if (ref === null) {
      return;
    }
    await this.attempt(dataset, () => definition.read(ref));
  }

  private async attempt(dataset: string, read: () => Promise<boolean>): Promise<void> {
    runInAction(() => {
      this.inFlight.add(dataset);
    });

    try {
      if (await read()) {
        // A failed read is never marked loaded: opening the tab again has to try once more, or a
        // one-second outage leaves it blank for the rest of the session.
        runInAction(() => {
          this.loaded.add(dataset);
        });
      }
    } finally {
      runInAction(() => {
        this.inFlight.delete(dataset);
      });
    }
  }
}
