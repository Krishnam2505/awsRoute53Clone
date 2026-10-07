'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';

import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { errorMessage, useDeleteHostedZone } from '@/lib/api';
import { displayName } from '@/lib/format';
import { useNotify } from '@/lib/notifications';

interface ZoneLike {
  id: string;
  name: string;
  record_count: number;
}

interface Props {
  zone: ZoneLike | null;
  onDismiss: () => void;
  onDeleted?: () => void;
}

// The apex NS and SOA records always exist and don't block deletion
const DEFAULT_RECORDS = 2;

export function DeleteZoneModal({ zone, onDismiss, onDeleted }: Props) {
  const notify = useNotify();
  const remove = useDeleteHostedZone();
  const name = zone ? displayName(zone.name) : '';
  const hasRecords = (zone?.record_count ?? 0) > DEFAULT_RECORDS;

  const close = () => {
    remove.reset();
    onDismiss();
  };

  const confirm = () => {
    if (!zone) return;
    remove.mutate(zone.id, {
      onSuccess: () => {
        notify.success(`The hosted zone ${name} was successfully deleted.`, { persist: true });
        remove.reset();
        onDeleted?.();
      },
    });
  };

  return (
    <ConfirmDeleteModal
      visible={zone !== null}
      header={`Delete ${name}?`}
      confirmationText="delete"
      loading={remove.isPending}
      error={remove.isError ? errorMessage(remove.error) : null}
      onDismiss={close}
      onConfirm={confirm}
      blocker={
        hasRecords ? (
          <Alert type="warning" header="This hosted zone contains records">
            You can&apos;t delete a hosted zone that contains records other than the default NS and
            SOA records. Delete the other records first, and then try again.
          </Alert>
        ) : undefined
      }
    >
      <Box variant="span">
        If you delete the hosted zone <b>{name}</b>, Route 53 stops responding to DNS queries for
        the domain. You can&apos;t undo this action.
      </Box>
    </ConfirmDeleteModal>
  );
}
