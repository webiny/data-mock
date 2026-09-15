import { makeAutoObservable, runInAction } from "mobx";

/**
 * How many live log lines the browser keeps per job. A deploy streams raw Pulumi output — `CI=1`
 * forces deployment logs on — so this is a tail, not the whole log.
 */
const LIVE_LOG_LIMIT = 2000;

/**
 * The tail of what a running job is printing right now.
 *
 * A deploy emits thousands of lines and the server-side buffer is unbounded, so the browser keeps
 * only the end of it. The full log is on the job once it finishes; this is the live view.
 */
export class LiveJobLogs {
  private _lines = new Map<string, string[]>();

  public constructor() {
    makeAutoObservable(this);
  }

  public append(jobId: string, line: string): void {
    runInAction(() => {
      const existing = this._lines.get(jobId) ?? [];
      const next = [...existing, line];
      this._lines.set(
        jobId,
        next.length > LIVE_LOG_LIMIT ? next.slice(next.length - LIVE_LOG_LIMIT) : next,
      );
      // MobX tracks the Map itself, not a mutation of a value inside it.
      this._lines = new Map(this._lines);
    });
  }

  public for(jobId: string): string {
    return (this._lines.get(jobId) ?? []).join("\n");
  }
}
