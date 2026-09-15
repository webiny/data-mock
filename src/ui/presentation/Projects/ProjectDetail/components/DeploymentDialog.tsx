import { observer } from "mobx-react-lite";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  List,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import type { IDeploymentDialogVM } from "../abstractions/ProjectDetailPresenter.js";

interface DeploymentDialogProps {
  vm: IDeploymentDialogVM;
  onClose: () => void;
  onToggleApp: (app: string) => void;
  onRegionChange: (region: string | null) => void;
  onTogglePreview: () => void;
  onReview: () => void;
  onTypedNameChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * Deploy gets one confirmation. Destroy gets two: a review of exactly what will be torn down, then
 * the project's name typed back. The second step exists because a destroy is the one action here
 * that cannot be undone by re-running it.
 */
export const DeploymentDialog = observer(function DeploymentDialog({
  vm,
  onClose,
  onToggleApp,
  onRegionChange,
  onTogglePreview,
  onReview,
  onTypedNameChange,
  onSubmit,
}: DeploymentDialogProps) {
  const isDestroy = vm.command === "destroy";
  const isConfirmStep = vm.step === "confirm";

  return (
    <Modal
      opened={vm.isOpen}
      onClose={onClose}
      centered
      size="lg"
      title={
        isDestroy
          ? `Destroy ${vm.stackName ?? "environment"}`
          : `Deploy ${vm.stackName ?? "environment"}`
      }
    >
      <Stack gap="sm">
        {vm.error && (
          <Alert color="red" variant="light">
            {vm.error}
          </Alert>
        )}

        {!isConfirmStep && (
          <>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Apps
              </Text>
              {vm.deployableApps.length === 0 && (
                <Text size="sm" c="dimmed">
                  This project has no local checkout, so there is nothing to{" "}
                  {isDestroy ? "destroy" : "deploy"}.
                </Text>
              )}
              <Group gap="md">
                {vm.deployableApps.map((app) => (
                  <Checkbox
                    key={app}
                    label={app}
                    checked={vm.selectedApps.includes(app)}
                    onChange={() => onToggleApp(app)}
                  />
                ))}
              </Group>
              {vm.deployableApps.length > 0 && vm.selectedApps.length === 0 && (
                <Text size="xs" c="dimmed">
                  None selected — every app will be {isDestroy ? "destroyed" : "deployed"}, in{" "}
                  {isDestroy ? "reverse " : ""}dependency order.
                </Text>
              )}
            </Stack>

            <Select
              label="Region"
              description="Leave empty to use this environment's own region"
              placeholder="Environment default"
              data={vm.regionOptions}
              value={vm.region}
              onChange={onRegionChange}
              searchable
              clearable
            />

            {!isDestroy && (
              <Checkbox
                label="Preview only"
                description="Pulumi plans the change and creates nothing"
                checked={vm.preview}
                onChange={onTogglePreview}
              />
            )}

            {isDestroy && <AtRiskPanel vm={vm} />}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              {isDestroy ? (
                <Button color="red" onClick={onReview}>
                  Continue
                </Button>
              ) : (
                <Button onClick={onSubmit} loading={vm.isSubmitting} disabled={!vm.canConfirm}>
                  {vm.preview ? "Preview" : "Deploy"}
                </Button>
              )}
            </Group>
          </>
        )}

        {isConfirmStep && (
          <>
            <Alert color="red" variant="light">
              <Text size="sm" fw={600}>
                This destroys real infrastructure and cannot be undone.
              </Text>
              <Text size="sm" mt="xs">
                The environment itself is kept — its seed entries, sync logs and job history stay.
                What goes is the deployed AWS resources.
              </Text>
            </Alert>

            <TextInput
              label={`Type "${vm.projectName}" to confirm`}
              placeholder={vm.projectName}
              value={vm.typedName}
              onChange={(event) => onTypedNameChange(event.currentTarget.value)}
              autoFocus
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={onSubmit}
                loading={vm.isSubmitting}
                disabled={!vm.canConfirm}
              >
                Destroy
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
});

/**
 * What the destroy would take. An unreadable stack shows a dash rather than 0 — claiming a stack
 * we could not read holds nothing is exactly the mistake that makes a destroy look safe.
 */
const AtRiskPanel = observer(function AtRiskPanel({ vm }: { vm: IDeploymentDialogVM }) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Will be destroyed
      </Text>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>App</Table.Th>
            <Table.Th>State</Table.Th>
            <Table.Th>Resources</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {vm.atRisk.map((entry) => (
            <Table.Tr key={entry.app}>
              <Table.Td>
                <Text size="sm">{entry.app}</Text>
              </Table.Td>
              <Table.Td>
                <Badge size="xs" variant="light" color={entry.deployed ? "green" : "gray"}>
                  {entry.deployed ? "deployed" : "not deployed"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {entry.resourceCount === null ? "—" : entry.resourceCount}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {vm.atRiskResources.length > 0 && (
        <Alert color="red" variant="light">
          <Text size="sm" fw={500}>
            Including:
          </Text>
          <List size="sm" mt="xs">
            {vm.atRiskResources.map((resource) => (
              <List.Item key={`${resource.label}-${resource.value}`}>
                {resource.label}: {resource.value}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
});
