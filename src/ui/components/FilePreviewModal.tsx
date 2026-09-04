import { Badge, Group, Image, Modal, Stack, Text } from "@mantine/core";

interface FilePreviewModalBadge {
  label: string;
  color: string;
}

interface FilePreviewModalFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  thumbnailUrl: string | null;
  badges: FilePreviewModalBadge[];
}

interface FilePreviewModalProps {
  opened: boolean;
  onClose: () => void;
  file: FilePreviewModalFile | null;
}

export function FilePreviewModal({ opened, onClose, file }: FilePreviewModalProps) {
  const isImage = file !== null && file.fileType.startsWith("image/");

  return (
    <Modal opened={opened} onClose={onClose} title={file?.fileName ?? ""} size="lg" centered>
      {file && (
        <Stack gap="md">
          {isImage && file.thumbnailUrl && (
            <Image src={file.thumbnailUrl} fit="contain" mah={500} alt={file.fileName} />
          )}

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {file.fileName}
            </Text>
            <Text size="xs" c="dimmed">
              {file.fileType} · {formatFileSize(file.fileSize)}
            </Text>
          </Stack>

          {file.badges.length > 0 && (
            <Group gap={4}>
              {file.badges.map((badge) => (
                <Badge key={badge.label} size="sm" variant="light" color={badge.color}>
                  {badge.label}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      )}
    </Modal>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
