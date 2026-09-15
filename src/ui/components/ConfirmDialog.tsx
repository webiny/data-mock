import { Button, Group, Modal, Text } from "@mantine/core";
import type { IActionConfirmationVM } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";

interface ConfirmDialogProps {
  vm: IActionConfirmationVM;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ vm, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal opened={vm.isOpen} onClose={onCancel} title={vm.title} centered>
      <Text>{vm.message}</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onCancel} disabled={vm.isSubmitting}>
          Cancel
        </Button>
        <Button onClick={onConfirm} loading={vm.isSubmitting}>
          {vm.confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
