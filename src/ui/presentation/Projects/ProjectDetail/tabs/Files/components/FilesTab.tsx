import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import type { FileWithPath } from "@mantine/dropzone";
import { FileCard } from "~/ui/components/FileCard.js";
import { FilePreviewModal } from "~/ui/components/FilePreviewModal.js";
import { ConfirmDialog } from "~/ui/components/ConfirmDialog.js";
import { useFeature } from "~/ui/di/useFeature.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { FilesTabFeature } from "../feature.js";

interface FilesTabProps {
  context: ProjectDetailTabContext;
}

export const FilesTab = observer(function FilesTab({ context }: FilesTabProps) {
  const { presenter } = useFeature(FilesTabFeature);
  const projectId = context.projectId;
  const environmentId = context.ref?.environmentId ?? null;
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /**
   * The component is what knows the tab is on screen, so it is what asks for the data. The
   * environment is a dependency as well as the project: the shell resolves it asynchronously, so
   * on a first visit this runs once without one, reads nothing, and runs again when it arrives.
   */
  useEffect(() => {
    void presenter.activate(context);
    return () => presenter.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenter, projectId, environmentId]);

  const vm = presenter.vm;
  const mergedFiles = vm.mergedFiles;

  const projectFileCount = mergedFiles.filter((file) => file.source === "project").length;
  const globalFiles = mergedFiles.filter((file) => file.source === "global");
  const globalFileCount = globalFiles.length;
  const previewFile = mergedFiles.find((file) => file.id === previewFileId) ?? null;
  const selectedGlobalCount = globalFiles.filter((file) => selectedIds.has(file.id)).length;

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
    const fileNames = globalFiles
      .filter((file) => selectedIds.has(file.id))
      .map((file) => file.fileName);
    if (fileNames.length > 0) {
      void presenter.uploadSelectedGlobalImages(fileNames);
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
          <Button
            variant="default"
            loading={vm.isPullingFiles}
            onClick={() => presenter.pullFiles()}
          >
            Pull Files from FM
          </Button>
          {selectedGlobalCount > 0 && (
            <Button variant="filled" loading={vm.isUploadingGlobal} onClick={handleUploadSelected}>
              Upload Selected ({selectedGlobalCount})
            </Button>
          )}
          <Button
            variant="light"
            loading={vm.isUploadingGlobal}
            disabled={globalFileCount === 0}
            onClick={() => void presenter.uploadAllGlobalImages()}
          >
            Upload All Global Images
          </Button>
        </Group>
      </Group>

      <Dropzone
        accept={IMAGE_MIME_TYPE}
        onDrop={(droppedFiles: FileWithPath[]) => void presenter.uploadFilesToProject(droppedFiles)}
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
              {...(file.source === "project"
                ? { onDelete: () => void presenter.deleteFile(file.id) }
                : {})}
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

      <ConfirmDialog
        vm={vm.confirmation}
        onConfirm={() => void presenter.confirmAction()}
        onCancel={() => presenter.cancelAction()}
      />
    </Stack>
  );
});
