import { Modal } from "@mantine/core";
import { Editor } from "@monaco-editor/react";

interface CodeViewerModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  value: string;
  language: string;
}

export function CodeViewerModal({ opened, onClose, title, value, language }: CodeViewerModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl" centered>
      <Editor
        height="60vh"
        language={language}
        value={value}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          wordWrap: "on",
          lineNumbers: "on",
        }}
      />
    </Modal>
  );
}
