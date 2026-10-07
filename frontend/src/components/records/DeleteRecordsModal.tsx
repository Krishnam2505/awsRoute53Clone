'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Table from '@cloudscape-design/components/table';

import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { errorMessage, useChangeBatch } from '@/lib/api';
import type { HostedZoneDetail, RecordSet } from '@/lib/api/types';
import { displayName, recordValueLines } from '@/lib/format';
import { useNotify } from '@/lib/notifications';

interface Props {
  zone: HostedZoneDetail;
  records: RecordSet[];
  visible: boolean;
  onDismiss: () => void;
  onDeleted: () => void;
}

/** Bulk delete: every selected record goes into one all-or-nothing change batch. */
export function DeleteRecordsModal({ zone, records, visible, onDismiss, onDeleted }: Props) {
  const notify = useNotify();
  const batch = useChangeBatch(zone.id);
  const deletable = records.filter((r) => !r.is_default);
  const protectedRecords = records.filter((r) => r.is_default);

  const close = () => {
    batch.reset();
    onDismiss();
  };

  const confirm = () => {
    batch.mutate(
      {
        comment: `Delete ${deletable.length} record(s)`,
        changes: deletable.map((r) => ({ action: 'DELETE' as const, record: { id: r.id } })),
      },
      {
        onSuccess: (change) => {
          const what =
            deletable.length === 1
              ? `Record ${displayName(deletable[0].name)} was`
              : `${deletable.length} records were`;
          notify.success(
            `${what} successfully deleted. Change ID: ${change.id} (status ${change.status}).`,
          );
          batch.reset();
          onDeleted();
        },
      },
    );
  };

  return (
    <ConfirmDeleteModal
      visible={visible}
      header={deletable.length === 1 ? 'Delete record' : 'Delete records'}
      loading={batch.isPending}
      error={batch.isError ? errorMessage(batch.error) : null}
      onDismiss={close}
      onConfirm={confirm}
      blocker={
        deletable.length === 0 ? (
          <Alert type="warning" header="These records can't be deleted">
            The NS and SOA records at the zone apex are required by Route 53. You can edit them, but
            you can&apos;t delete them.
          </Alert>
        ) : undefined
      }
    >
      {deletable.length > 0 && (
        <Box variant="span">Are you sure that you want to delete the following records?</Box>
      )}
      {deletable.length > 0 && (
        <Table
          variant="embedded"
          items={deletable}
          trackBy="id"
          columnDefinitions={[
            { id: 'name', header: 'Record name', cell: (r) => displayName(r.name) },
            { id: 'type', header: 'Type', cell: (r) => r.type },
            {
              id: 'value',
              header: 'Value/Route traffic to',
              cell: (r) => recordValueLines(r).join(', '),
            },
          ]}
        />
      )}
      {protectedRecords.length > 0 && deletable.length > 0 && (
        <Alert type="info">
          The default NS and SOA records you selected will be kept; Route 53 doesn&apos;t let you
          delete them.
        </Alert>
      )}
    </ConfirmDeleteModal>
  );
}
