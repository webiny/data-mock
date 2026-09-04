import type { JobStatus, JobType } from "~/shared/jobs/constants.js";

export interface WSJobStatus {
  jobId: string;
  projectId: string | null;
  type: JobType;
  status: JobStatus;
}

export interface WSJobProgress {
  jobId: string;
  projectId: string | null;
  progress: number;
  progressLabel: string | null;
}

export interface WSJobLog {
  jobId: string;
  projectId: string | null;
  line: string;
}

export interface WSEventMap {
  "job:status": WSJobStatus;
  "job:progress": WSJobProgress;
  "job:log": WSJobLog;
}

export type WSEventType = keyof WSEventMap;
