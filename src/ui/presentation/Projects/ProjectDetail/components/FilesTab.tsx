import { useState } from "react";
import { Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import type { FileWithPath } from "@mantine/dropzone";
import { FileCard } from "~/ui/components/FileCard.js";
import { FilePreviewModal } from "~/ui/components/FilePreviewModal.js";
import type { IMergedFileVM } from "../abstractions/ProjectDetailPresenter.js";

interface FilesTabProps {
  mergedFiles: IMergedFileVM[];
  onUploadFiles: (files: File[]) => void;
  onUploadAllGlobal: () => void;
  onUploadSelected: (fileNames: string[]) => void;
  onPullFiles: () => void;
  onDelete: (fileId: string) => void;
  isUploadingGlobal: boolean;
  isPullingFiles: boolean;
  selectedTenant: string;
}

export function FilesTab({
  mergedFiles,
  onUploadFiles,
  onUploadAllGlobal,
  onUploadSelected,
  onPullFiles,
  onDelete,
  isUploadingGlobal,
  isPullingFiles,
}: FilesTabProps) {
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const projectFileCount = mergedFiles.filter((f) => f.source === "project").length;
  const globalFiles = mergedFiles.filter((f) => f.source === "global");
  const globalFileCount = globalFiles.length;
  const previewFile = mergedFiles.find((f) => f.id === previewFileId) ?? null;
  const selectedGlobalCount = globalFiles.filter((f) => selectedIds.has(f.id)).length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleUploadSelected = () => {
    const fileNames = globalFiles.filter((f) => selectedIds.has(f.id)).map((f) => f.fileName);
    if (fileNames.length > 0) {
      onUploadSelected(fileNames);
      setSelectedIds(new Set());
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          {projectFileCount} project file{projectFileCount === 1 ? "" : "s"}, {globalFileCount}{" "}
          global file{globalFileCount === 1 ? "" : "s"}
        </Text>
        <Group gap="xs">
          <Button variant="default" loading={isPullingFiles} onClick={onPullFiles}>
            Pull Files from FM
          </Button>
          {selectedGlobalCount > 0 && (
            <Button variant="filled" loading={isUploadingGlobal} onClick={handleUploadSelected}>
              Upload Selected ({selectedGlobalCount})
            </Button>
          )}
          <Button
            variant="light"
            loading={isUploadingGlobal}
            disabled={globalFileCount === 0}
            onClick={onUploadAllGlobal}
          >
            Upload All Global Images
          </Button>
        </Group>
      </Group>

      <Dropzone
        accept={IMAGE_MIME_TYPE}
        onDrop={(droppedFiles: FileWithPath[]) => onUploadFiles(droppedFiles)}
      >
        <Group justify="center" gap="xl" mih={100} style={{ pointerEvents: "none" }}>
          <Stack align="center" gap={4}>
            <Text size="sm" fw={500}>
              Drag images here or click to select files
            </Text>
            <Text size="xs" c="dimmed">
              Files are uploaded directly to this project's file manager
            </Text>
          </Stack>
        </Group>
      </Dropzone>

      {mergedFiles.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          No files yet. Drop files above or pull global images from the File Manager.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }}>
          {mergedFiles.map((file) => (
            <FileCard
              key={file.id}
              fileName={file.fileName}
              fileType={file.fileType}
              fileSize={file.fileSize ?? 0}
              thumbnailUrl={file.fileType.startsWith("image/") ? file.thumbnailUrl : null}
              badges={file.badges}
              onClick={() => setPreviewFileId(file.id)}
              {...(file.source === "project" ? { onDelete: () => onDelete(file.id) } : {})}
              {...(file.source === "global"
                ? {
                    selected: selectedIds.has(file.id),
                    onSelect: () => toggleSelect(file.id),
                  }
                : {})}
            />
          ))}
        </SimpleGrid>
      )}

      <FilePreviewModal
        opened={previewFile !== null}
        onClose={() => setPreviewFileId(null)}
        file={
          previewFile
            ? {
                fileName: previewFile.fileName,
                fileType: previewFile.fileType,
                fileSize: previewFile.fileSize ?? 0,
                thumbnailUrl: previewFile.fileType.startsWith("image/")
                  ? previewFile.thumbnailUrl
                  : null,
                badges: previewFile.badges,
              }
            : null
        }
      />
    </Stack>
  );
}
