import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { JobsTable } from "~/ui/components/JobsTable.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { JobsTabFeature } from "../feature.js";

interface JobsTabProps {
  context: ProjectDetailTabContext;
}

export const JobsTab = observer(function JobsTab({ context }: JobsTabProps) {
  const { presenter } = useFeature(JobsTabFeature);
  const projectId = context.projectId;
  const environmentId = context.ref?.environmentId ?? null;

  /**
   * Jobs is project-scoped, not environment-scoped, so this runs — and reads — as soon as
   * `projectId` is known, on a project that has no environment at all. `environmentId` stays a
   * dependency only so a later resolution does not leave the effect stale.
   */
  useEffect(() => {
    void presenter.activate(context);
    return () => presenter.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenter, projectId, environmentId]);

  const vm = presenter.vm;

  return (
    <JobsTable
      jobs={vm.jobs}
      selectedJob={vm.selectedJob}
      isLoadingSelectedJob={vm.isLoadingSelectedJob}
      onOpenJob={(jobId) => void presenter.openJob(jobId)}
      onCloseJob={presenter.closeJob}
      totalCount={vm.jobsTotalCount}
      page={vm.jobsPage}
      typeFilter={vm.jobsTypeFilter}
      statusFilter={vm.jobsStatusFilter}
      onPageChange={presenter.loadJobsPage}
      onFilterChange={presenter.setJobsFilter}
      onClearFilter={presenter.clearJobsFilter}
      onCancel={(jobId) => void presenter.cancelJob(jobId)}
      liveLogsFor={presenter.liveLogsFor}
    />
  );
});
