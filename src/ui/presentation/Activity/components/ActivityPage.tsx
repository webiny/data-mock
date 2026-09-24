import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Alert, Stack, Title } from "@mantine/core";
import { JobsTable } from "~/ui/components/JobsTable.js";
import type { ActivityPresenter } from "../abstractions/ActivityPresenter.js";

interface ActivityPageProps {
  presenter: ActivityPresenter.Interface;
}

export const ActivityPage = observer(function ActivityPage({ presenter }: ActivityPageProps) {
  const vm = presenter.vm;

  useEffect(() => {
    void presenter.load();
    return () => presenter.dispose();
  }, [presenter]);

  return (
    <Stack gap="md">
      <Title order={2}>Activity</Title>

      {vm.error !== null && (
        <Alert color="red" title="Could not load the jobs">
          {vm.error}
        </Alert>
      )}

      <JobsTable
        jobs={vm.jobs}
        selectedJob={vm.selectedJob}
        isLoadingSelectedJob={vm.isLoadingSelectedJob}
        onOpenJob={(jobId) => void presenter.openJob(jobId)}
        onCloseJob={() => presenter.closeJob()}
        totalCount={vm.totalCount}
        page={vm.page}
        typeFilter={vm.typeFilter}
        statusFilter={vm.statusFilter}
        onPageChange={(page) => presenter.loadPage(page)}
        onFilterChange={(key, value) => presenter.setFilter(key, value)}
        onClearFilter={() => presenter.clearFilter()}
        onCancel={(jobId) => void presenter.cancelJob(jobId)}
      />
    </Stack>
  );
});
