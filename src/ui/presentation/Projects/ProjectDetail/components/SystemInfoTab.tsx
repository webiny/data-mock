import { observer } from "mobx-react-lite";
import {
  ActionIcon,
  Alert,
  CopyButton,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import type { ISystemInfoSectionVM } from "../abstractions/ProjectDetailPresenter.js";

interface SystemInfoTabProps {
  sections: ISystemInfoSectionVM[];
  /** Why the panel is empty, when it is. */
  notice: string | null;
}

export const SystemInfoTab = observer(function SystemInfoTab({
  sections,
  notice,
}: SystemInfoTabProps) {
  return (
    <Stack gap="md">
      <Text fw={600}>System Info</Text>

      {notice !== null && (
        <Alert color="gray" variant="light">
          {notice}
        </Alert>
      )}

      {notice === null && sections.length === 0 && (
        <Text c="dimmed" fs="italic">
          This environment&apos;s stack output carries none of the keys this panel reads.
        </Text>
      )}

      {sections.map((section) => (
        <Paper key={section.title} withBorder p="sm">
          <Stack gap="xs">
            <Text size="sm" fw={600} tt="uppercase" c="dimmed">
              {section.title}
            </Text>
            <Table>
              <Table.Tbody>
                {section.items.map((item) => (
                  <Table.Tr key={`${section.title}-${item.label}`}>
                    <Table.Td w={220}>
                      <Text size="sm" c="dimmed">
                        {item.label}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Text size="sm" style={{ wordBreak: "break-all" }}>
                          {item.value}
                        </Text>
                        <CopyButton value={item.value}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy"}>
                              <ActionIcon variant="subtle" size="sm" onClick={copy}>
                                {copied ? "✓" : "⧉"}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
});
