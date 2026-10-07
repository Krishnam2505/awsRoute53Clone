'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { type ReactNode, useEffect, useState } from 'react';

interface Props {
  visible: boolean;
  header: string;
  children: ReactNode;
  /** When set, the user must type this word before Delete enables. */
  confirmationText?: string;
  /** Replaces the confirmation input, e.g. "you can't delete this yet". */
  blocker?: ReactNode;
  error?: string | null;
  loading?: boolean;
  deleteLabel?: string;
  onDismiss: () => void;
  onConfirm: () => void;
}

/** Console-style delete dialog with an optional typed confirmation. */
export function ConfirmDeleteModal({
  visible,
  header,
  children,
  confirmationText,
  blocker,
  error,
  loading,
  deleteLabel = 'Delete',
  onDismiss,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (visible) setTyped('');
  }, [visible]);

  const confirmed = !confirmationText || typed === confirmationText;
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={header}
      closeAriaLabel="Close dialog"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            {!blocker && (
              <Button
                variant="primary"
                disabled={!confirmed}
                loading={loading}
                onClick={onConfirm}
                data-testid="confirm-delete"
              >
                {deleteLabel}
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {children}
        {blocker}
        {!blocker && confirmationText && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (confirmed) onConfirm();
            }}
          >
            <FormField
              label={
                <>
                  To confirm deletion, type <i>{confirmationText}</i> in the field.
                </>
              }
            >
              <Input
                value={typed}
                placeholder={confirmationText}
                ariaLabel={`Type ${confirmationText} to confirm`}
                onChange={({ detail }) => setTyped(detail.value)}
              />
            </FormField>
          </form>
        )}
        {error && <Alert type="error">{error}</Alert>}
      </SpaceBetween>
    </Modal>
  );
}
