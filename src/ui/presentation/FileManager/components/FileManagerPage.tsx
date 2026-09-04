import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Alert, Button, Group, NumberInput, SimpleGrid, Stack, Text } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import type { FileWithPath } from "@mantine/dropzone";
import { FileCard } from "~/ui/components/FileCard.js";
import { FilePreviewModal } from "~/ui/components/FilePreviewModal.js";
import type { FileManagerPresenter } from "../abstractions/FileManagerPresenter.js";

interface FileManagerPageProps {
  presenter: FileManagerPresenter.Interface;
}

export const FileManagerPage = observer(function FileManagerPage({
  presenter,
}: FileManagerPageProps) {
  useEffect(() => {
    void presenter.load();
  }, [presenter]);

  const { files, isLoading, isPullingPicsum, picsumCount, error, previewFile } = presenter.vm;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Group align="flex-end" gap="sm">
          <NumberInput
            label="Pull from Picsum"
            description="Number of placeholder images"
            min={1}
            max={100}
            value={picsumCount}
            onChange={(value) => presenter.setPicsumCount(typeof value === "number" ? value : 0)}
            w={220}
          />
          <Button loading={isPullingPicsum} onClick={() => void presenter.pullPicsum()}>
            Pull Images
          </Button>
        </Group>
        <Text size="sm" c="dimmed">
          {files.length} file{files.length === 1 ? "" : "s"}
        </Text>
      </Group>

      {error && (
        <Alert color="red" title="Error" variant="light">
          {error}
        </Alert>
      )}

      <Dropzone
        accept={IMAGE_MIME_TYPE}
        onDrop={(droppedFiles: FileWithPath[]) => void presenter.uploadFiles(droppedFiles)}
        loading={isLoading}
      >
        <Group justify="center" gap="xl" mih={100} style={{ pointerEvents: "none" }}>
          <Stack align="center" gap={4}>
            <Text size="sm" fw={500}>
              Drag images here or click to select files
            </Text>
            <Text size="xs" c="dimmed">
              Files are stored locally and can be uploaded to project file managers
            </Text>
          </Stack>
        </Group>
      </Dropzone>

      {files.length === 0 && !isLoading ? (
        <Text c="dimmed" ta="center" mt="xl">
          No local files yet. Pull placeholder images or drop files above.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }}>
          {files.map((file) => (
            <FileCard
              key={file.fileName}
              fileName={file.fileName}
              fileType={file.fileType}
              fileSize={file.fileSize}
              thumbnailUrl={file.isImage ? file.thumbnailUrl : null}
              badges={file.badges}
              onClick={() => presenter.openPreview(file)}
              onDelete={() => void presenter.deleteFile(file.fileName)}
            />
          ))}
        </SimpleGrid>
      )}

      <FilePreviewModal
        opened={previewFile !== null}
        onClose={() => presenter.closePreview()}
        file={
          previewFile
            ? {
                fileName: previewFile.fileName,
                fileType: previewFile.fileType,
                fileSize: previewFile.fileSize,
                thumbnailUrl: previewFile.isImage ? previewFile.thumbnailUrl : null,
                badges: previewFile.badges,
              }
            : null
        }
      />
    </Stack>
  );
});
