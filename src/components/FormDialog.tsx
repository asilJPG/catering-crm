import type {ReactNode} from 'react';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  VStack,
} from '@astryxdesign/core/Layout';
import {Button} from '@astryxdesign/core/Button';

export function FormDialog({
  isOpen,
  title,
  subtitle,
  submitLabel = 'Сохранить',
  width = 520,
  isSubmitDisabled,
  onClose,
  onSubmit,
  children,
}: {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  submitLabel?: string;
  width?: number;
  isSubmitDisabled?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      purpose="form"
      maxHeight="90vh"
      width={width}>
      <Layout
        header={
          <DialogHeader
            title={title}
            subtitle={subtitle}
            onOpenChange={() => onClose()}
          />
        }
        content={
          <LayoutContent isScrollable>
            <VStack gap={4}>{children}</VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Отмена" variant="secondary" onClick={onClose} />
              <Button
                label={submitLabel}
                variant="primary"
                isDisabled={isSubmitDisabled}
                onClick={onSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
