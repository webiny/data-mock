import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  Stack,
  Tabs,
  Text,
  Checkbox,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type { AddProjectMode, AddProjectPresenter } from "../abstractions/AddProjectPresenter.js";

interface AddProjectFormProps {
  presenter: AddProjectPresenter.Interface;
  onSuccess: () => void;
}

export const AddProjectForm = observer(function AddProjectForm({
  presenter,
  onSuccess,
}: AddProjectFormProps) {
  const vm = presenter.vm;

  useEffect(() => {
    // The default tab is Scan, so its roots are needed before the user touches anything.
    void presenter.loadScanRoots();
  }, [presenter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await presenter.submit();
    if (success) {
      onSuccess();
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Stack gap="sm">
        {vm.error && (
          <Alert color="red" variant="light">
            {vm.error}
          </Alert>
        )}

        <Tabs
          value={vm.mode}
          onChange={(value) => value && presenter.setMode(value as AddProjectMode)}
        >
          <Tabs.List>
            <Tabs.Tab value="scan">Scan</Tabs.Tab>
            <Tabs.Tab value="browse">Browse</Tabs.Tab>
            <Tabs.Tab value="path">Path</Tabs.Tab>
            <Tabs.Tab value="remote">Remote</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="scan" pt="sm">
            <ScanPanel presenter={presenter} />
          </Tabs.Panel>

          <Tabs.Panel value="browse" pt="sm">
            <BrowsePanel presenter={presenter} />
          </Tabs.Panel>

          <Tabs.Panel value="path" pt="sm">
            <TextInput
              label="Project folder"
              description="Absolute path to a Webiny checkout"
              placeholder="/Users/you/work/my-webiny-project"
              value={vm.rootPath}
              onChange={(e) => presenter.setRootPath(e.currentTarget.value)}
            />
          </Tabs.Panel>

          <Tabs.Panel value="remote" pt="sm">
            <Stack gap="sm">
              <Text size="xs" c="dimmed">
                A project with no checkout on this machine. It can be seeded, but not deployed,
                destroyed or synced.
              </Text>
              <TextInput
                label="API URL"
                placeholder="https://your-webiny-api.com"
                value={vm.apiUrl}
                onChange={(e) => presenter.setApiUrl(e.currentTarget.value)}
              />
              <TextInput
                label="API Token"
                placeholder="your-api-token"
                type="password"
                value={vm.apiToken}
                onChange={(e) => presenter.setApiToken(e.currentTarget.value)}
              />
              <TextInput
                label="Tenant"
                placeholder="root"
                value={vm.tenant}
                onChange={(e) => presenter.setTenant(e.currentTarget.value)}
              />
              <TextInput
                label="Webiny Version"
                description="Drives which GraphQL operations are used"
                placeholder="6.0.0"
                value={vm.webinyVersion}
                onChange={(e) => presenter.setWebinyVersion(e.currentTarget.value)}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {vm.mode !== "remote" && vm.mode !== "scan" && vm.rootPath !== "" && (
          <Alert color="blue" variant="light" py="xs">
            <Text size="sm">{vm.rootPath}</Text>
          </Alert>
        )}

        {vm.mode === "scan" && vm.selectedCount > 1 && (
          <Alert color="blue" variant="light" py="xs">
            <Text size="sm">
              {vm.selectedCount} projects selected. Each is named after its folder.
            </Text>
          </Alert>
        )}

        {/* Several checkouts cannot share one name, so the field is only offered for a single pick. */}
        {(vm.mode !== "scan" || vm.selectedCount <= 1) && (
          <TextInput
            label="Name"
            placeholder="My Webiny Project"
            value={vm.name}
            onChange={(e) => presenter.setName(e.currentTarget.value)}
            required
          />
        )}

        <Button type="submit" loading={vm.isSubmitting} disabled={!vm.canSubmit}>
          {vm.mode === "scan" && vm.selectedCount > 1
            ? `Add ${vm.selectedCount} Projects`
            : "Add Project"}
        </Button>
      </Stack>
    </form>
  );
});

interface PanelProps {
  presenter: AddProjectPresenter.Interface;
}

/**
 * Scanned checkouts, including the ones already registered. Those are shown disabled rather than
 * hidden — the list is a picture of the disk, and a checkout vanishing from it after being added
 * reads as the scan having lost it.
 */
const ScanPanel = observer(function ScanPanel({ presenter }: PanelProps) {
  const vm = presenter.vm;

  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <Text size="xs" fw={500} c="dimmed">
          Scan roots
        </Text>
        {vm.scanRoots.length === 0 && (
          <Text size="xs" c="dimmed" fs="italic">
            None yet — type a folder that holds your Webiny checkouts below and press Add root.
          </Text>
        )}
        {vm.scanRoots.map((root) => (
          <Group key={root.id} gap="xs" justify="space-between">
            <Text size="xs" style={{ wordBreak: "break-all" }}>
              {root.path}
            </Text>
            <Tooltip label="Stop scanning this folder. Projects already added are kept.">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => void presenter.removeScanRoot(root.id)}
              >
                ×
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
      </Stack>

      <Group gap="xs" align="flex-end">
        <TextInput
          style={{ flex: 1 }}
          size="xs"
          placeholder="/Users/you/work"
          value={vm.newScanRootPath}
          onChange={(e) => presenter.setNewScanRootPath(e.currentTarget.value)}
        />
        <Button size="xs" variant="light" onClick={() => void presenter.addScanRoot()}>
          Add root
        </Button>
        <Button
          size="xs"
          variant="light"
          loading={vm.isScanning}
          onClick={() => void presenter.scan()}
        >
          Scan
        </Button>
      </Group>

      {vm.scanErrors.length > 0 && (
        <Alert color="yellow" variant="light" py="xs">
          <Text size="xs" fw={500}>
            Could not read:
          </Text>
          {vm.scanErrors.map((error) => (
            <Text key={error.path} size="xs">
              {error.path} — {error.message}
            </Text>
          ))}
        </Alert>
      )}

      {vm.isScanning && (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Scanning...
          </Text>
        </Group>
      )}

      {!vm.isScanning && vm.hasScanned && vm.candidates.length === 0 && (
        <Text size="sm" c="dimmed">
          No Webiny projects found under those roots.
        </Text>
      )}

      {vm.selectableCount > 1 && (
        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => presenter.selectAllCandidates()}
          >
            Select all ({vm.selectableCount})
          </Button>
          {vm.selectedCount > 0 && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => presenter.clearSelectedCandidates()}
            >
              Clear
            </Button>
          )}
        </Group>
      )}

      <Stack gap={4}>
        {vm.candidates.map((candidate) => (
          <Card
            key={candidate.rootPath}
            withBorder
            padding="xs"
            style={{
              cursor: candidate.registered ? "not-allowed" : "pointer",
              opacity: candidate.registered ? 0.55 : 1,
            }}
            bg={candidate.selected ? "var(--mantine-color-blue-light)" : "transparent"}
            onClick={() => presenter.selectCandidate(candidate.rootPath)}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                <Checkbox
                  size="xs"
                  checked={candidate.selected}
                  disabled={candidate.registered}
                  readOnly
                  aria-label={`Select ${candidate.name}`}
                />
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500}>
                    {candidate.name}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                    {candidate.rootPath}
                  </Text>
                </Stack>
              </Group>
              <Group gap={4} wrap="nowrap">
                <Badge size="xs" variant="light">
                  {candidate.versionLabel}
                </Badge>
                {candidate.registered && (
                  <Badge size="xs" variant="outline" color="gray">
                    already added
                  </Badge>
                )}
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
});

const BrowsePanel = observer(function BrowsePanel({ presenter }: PanelProps) {
  const vm = presenter.vm;

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="nowrap">
        <Button
          size="xs"
          variant="light"
          disabled={vm.browseParentPath === null}
          onClick={() => void presenter.browseUp()}
        >
          Up
        </Button>
        <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
          {vm.browsePath || "..."}
        </Text>
      </Group>

      {vm.browseIsWebinyProject && (
        <Button size="xs" onClick={() => presenter.chooseBrowsedDirectory()}>
          Use this folder
        </Button>
      )}

      <Paper withBorder p={4} mah={260} style={{ overflowY: "auto" }}>
        {vm.isBrowsing && (
          <Group gap="xs" p="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Loading...
            </Text>
          </Group>
        )}

        {!vm.isBrowsing && vm.browseEntries.length === 0 && (
          <Text size="sm" c="dimmed" p="xs">
            No subdirectories here.
          </Text>
        )}

        {!vm.isBrowsing &&
          vm.browseEntries.map((entry) => (
            <Box
              key={entry.path}
              px="xs"
              py={4}
              style={{ cursor: entry.readable ? "pointer" : "not-allowed" }}
              onClick={() => entry.readable && void presenter.browse(entry.path)}
            >
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Text size="sm" c={entry.readable ? "inherit" : "dimmed"}>
                  {entry.name}
                </Text>
                {entry.isWebinyProject && (
                  <Badge size="xs" variant="light">
                    Webiny
                  </Badge>
                )}
                {!entry.readable && (
                  <Text size="xs" c="dimmed">
                    unreadable
                  </Text>
                )}
              </Group>
            </Box>
          ))}
      </Paper>
    </Stack>
  );
});
