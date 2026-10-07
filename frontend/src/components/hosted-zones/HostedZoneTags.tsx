'use client';

import { useCollection } from '@cloudscape-design/collection-hooks';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import TagEditor, { type TagEditorProps } from '@cloudscape-design/components/tag-editor';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useState } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { InfoLink } from '@/components/common/InfoLink';
import { errorMessage, fieldErrorMap, useUpdateHostedZone } from '@/lib/api';
import type { HostedZoneDetail, Tag } from '@/lib/api/types';
import { displayName } from '@/lib/format';
import { useNotify } from '@/lib/notifications';

function ManageTagsModal({
  zone,
  visible,
  onDismiss,
}: {
  zone: HostedZoneDetail;
  visible: boolean;
  onDismiss: () => void;
}) {
  const notify = useNotify();
  const update = useUpdateHostedZone(zone.id);
  const [tags, setTags] = useState<TagEditorProps.Tag[]>([]);

  // Reset the editor to the saved tags each time it opens
  const [openedFor, setOpenedFor] = useState<boolean>(false);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setTags(zone.tags.map((t) => ({ key: t.key, value: t.value, existing: true })));
      update.reset();
    }
  }

  const save = () => {
    const kept = tags
      .filter((t) => !t.markedForRemoval && t.key.trim())
      .map((t) => ({ key: t.key.trim(), value: t.value.trim() }));
    update.mutate(
      { tags: kept },
      {
        onSuccess: () => {
          notify.success(`Tags for ${displayName(zone.name)} were successfully updated.`);
          onDismiss();
        },
      },
    );
  };

  const fieldErrors = fieldErrorMap(update.error);
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      size="large"
      header="Manage tags"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" loading={update.isPending} onClick={save}>
              Save changes
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <TagEditor tags={tags} onChange={({ detail }) => setTags([...detail.tags])} tagLimit={50} />
        {update.isError && (
          <Box color="text-status-error">
            {Object.values(fieldErrors)[0] ?? errorMessage(update.error)}
          </Box>
        )}
      </SpaceBetween>
    </Modal>
  );
}

/** "Hosted zone tags" tab: client-side filtered with Cloudscape's useCollection. */
export function HostedZoneTags({ zone }: { zone: HostedZoneDetail }) {
  const [managing, setManaging] = useState(false);
  const { items, collectionProps, filterProps, paginationProps, filteredItemsCount } =
    useCollection<Tag>(zone.tags, {
      filtering: {
        empty: <EmptyState title="No tags" subtitle="This hosted zone doesn't have any tags." />,
        noMatch: <EmptyState title="No matches" subtitle="We can't find a match." />,
      },
      pagination: { pageSize: 20 },
      sorting: { defaultState: { sortingColumn: { sortingField: 'key' } } },
    });

  return (
    <>
      <Table
        {...collectionProps}
        items={items}
        trackBy="key"
        columnDefinitions={[
          { id: 'key', header: 'Key', cell: (t) => t.key, sortingField: 'key' },
          { id: 'value', header: 'Value', cell: (t) => t.value || '-', sortingField: 'value' },
        ]}
        header={
          <Header
            counter={`(${zone.tags.length})`}
            info={<InfoLink helpKey="tags" label="Tags" />}
            actions={<Button onClick={() => setManaging(true)}>Manage tags</Button>}
          >
            Tags
          </Header>
        }
        filter={
          <TextFilter
            {...filterProps}
            filteringPlaceholder="Find tags"
            countText={`${filteredItemsCount ?? 0} matches`}
          />
        }
        pagination={<Pagination {...paginationProps} />}
      />
      <ManageTagsModal zone={zone} visible={managing} onDismiss={() => setManaging(false)} />
    </>
  );
}
