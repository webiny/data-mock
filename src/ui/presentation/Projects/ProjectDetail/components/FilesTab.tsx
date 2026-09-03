import { Badge, Button, Stack, Table, Text, Title } from "@mantine/core";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface FilesTabProps {
  files: ProjectDetailPresenter.VM["files"];
  onDelete: (fileId: string) => void;
}

export function FilesTab({ files, onDelete }: FilesTabProps) {
  if (files.length === 0) {
    return (
      <Stack align="center" mt="xl">
        <Text c="dimmed">No uploaded files.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Title order={4}>Uploaded Files</Title>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>File Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>Tenant</Table.Th>
            <Table.Th>Uploaded</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {files.map((file) => (
            <Table.Tr key={file.id}>
              <Table.Td>{file.fileName}</Table.Td>
              <Table.Td>
                <Badge variant="light" size="sm">
                  {file.fileType}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{file.fileSize != null ? formatBytes(file.fileSize) : "—"}</Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="outline" size="sm">
                  {file.tenant}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{new Date(file.uploadedAt).toLocaleDateString()}</Text>
              </Table.Td>
              <Table.Td>
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-xs"
                  onClick={() => onDelete(file.id)}
                >
                  Delete
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
