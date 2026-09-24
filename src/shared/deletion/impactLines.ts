import type { DeletionImpact } from "~/shared/types.js";

export interface DeletionImpactLine {
  label: string;
  count: number;
}

const LABELS: Array<[keyof DeletionImpact, string]> = [
  ["environments", "environments"],
  ["stacks", "stack records"],
  ["tenants", "tenants"],
  ["groups", "model groups"],
  ["models", "models"],
  ["files", "uploaded files"],
  ["seedJobs", "seed jobs"],
  ["seedEntries", "seed entries"],
  ["syncLogs", "sync logs"],
  ["jobs", "job records"],
  ["seedTemplates", "seed templates"],
];

/**
 * Turns the raw counts into the lines a confirmation shows. Zero counts are dropped: the list
 * exists to show what would be lost, and a row of noughts buries the numbers that matter.
 *
 * Shared by the UI and the CLI so the two never disagree on what a delete would destroy.
 */
export function toDeletionImpactLines(impact: DeletionImpact): DeletionImpactLine[] {
  return LABELS.filter(([key]) => impact[key] > 0).map(([key, label]) => ({
    label,
    count: impact[key],
  }));
}

export function totalDeletionImpact(lines: DeletionImpactLine[]): number {
  return lines.reduce((total, line) => total + line.count, 0);
}
