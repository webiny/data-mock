import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Checkbox,
  Group,
  Image,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";

interface FileCardBadge {
  label: string;
  color: string;
}

interface FileCardProps {
  fileName: string;
  fileType: string;
  fileSize: number;
  thumbnailUrl: string | null;
  badges: FileCardBadge[];
  onClick: () => void;
  onDelete?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}

export function FileCard({
  fileName,
  fileType,
  fileSize,
  thumbnailUrl,
  badges,
  onClick,
  onDelete,
  selected,
  onSelect,
}: FileCardProps) {
  return (
    <Card
      withBorder
      padding="xs"
      style={{
        cursor: "pointer",
        position: "relative",
        outline: selected ? "2px solid var(--mantine-color-blue-5)" : undefined,
      }}
      onClick={onClick}
    >
      {onSelect && (
        <Checkbox
          checked={selected ?? false}
          onChange={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          onClick={(event) => event.stopPropagation()}
          size="sm"
          style={{ position: "absolute", top: 6, left: 6, zIndex: 1 }}
        />
      )}
      {onDelete && (
        <ActionIcon
          variant="filled"
          color="red"
          size="sm"
          radius="xl"
          style={{ position: "absolute", top: 6, right: 6, zIndex: 1 }}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          ✕
        </ActionIcon>
      )}

      {thumbnailUrl ? (
        <Card.Section>
          <Image src={thumbnailUrl} height={140} fit="cover" alt={fileName} />
        </Card.Section>
      ) : (
        <Card.Section>
          <Box h={140} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ThemeIcon variant="light" color="gray" size={48} radius="md">
              <Text size="xs" fw={600}>
                {fileType || "FILE"}
              </Text>
            </ThemeIcon>
          </Box>
        </Card.Section>
      )}

      <Stack gap={4} mt="xs">
        <Text size="sm" truncate="end">
          {fileName}
        </Text>
        <Text size="xs" c="dimmed">
          {formatFileSize(fileSize)}
        </Text>
        {badges.length > 0 && (
          <Group gap={4}>
            {badges.map((badge) => (
              <Badge key={badge.label} size="xs" variant="light" color={badge.color}>
                {badge.label}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
    </Card>
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
