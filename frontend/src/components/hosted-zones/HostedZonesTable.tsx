'use client';

import Button from '@cloudscape-design/components/button';
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Pagination from '@cloudscape-design/components/pagination';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { InfoLink } from '@/components/common/InfoLink';
import { errorMessage, useHostedZones } from '@/lib/api';
import type { HostedZoneSummary } from '@/lib/api/types';
import { usePageSetup, useShortcuts } from '@/lib/console';
import { displayName, zoneTypeLabel } from '@/lib/format';
import { useFollow } from '@/lib/navigation';
import { useStoredState } from '@/lib/preferences';
import { useUrlState } from '@/lib/use-url-state';

import { DeleteZoneModal } from './DeleteZoneModal';

const BASE = '/route53/v2/hostedzones';

const TYPE_OPTIONS = [
  { value: '', label: 'All hosted zone types' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

const COLUMN_LABELS: Record<string, string> = {
  name: 'Hosted zone name',
  type: 'Type',
  createdBy: 'Created by',
  recordCount: 'Record count',
  description: 'Description',
  id: 'Hosted zone ID',
};

const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences = {
  pageSize: 10,
  wrapLines: false,
  stripedRows: false,
  contentDisplay: Object.keys(COLUMN_LABELS).map((id) => ({ id, visible: true })),
};

// Table sorting fields map onto the API's sort parameter
const SORT_FIELDS: Record<string, string> = {
  name: 'name',
  type: 'type',
  recordCount: 'record_count',
  description: 'description',
  id: 'id',
};

export function HostedZonesTable() {
  const router = useRouter();
  const onFollow = useFollow();
  const url = useUrlState();
  const [preferences, setPreferences] = useStoredState('r53-zones-table', DEFAULT_PREFERENCES);
  const [selected, setSelected] = useState<HostedZoneSummary[]>([]);
  const [toDelete, setToDelete] = useState<HostedZoneSummary | null>(null);

  const search = url.get('search');
  const type = url.get('type');
  const page = Number(url.get('page')) || 1;
  const sort = url.get('sort') || 'name';
  const order = url.get('order') === 'desc' ? 'desc' : 'asc';
  const [filterText, setFilterText] = useState(search);
  useEffect(() => setFilterText(search), [search]);

  usePageSetup({
    breadcrumbs: [{ text: 'Hosted zones', href: BASE }],
    contentType: 'table',
    helpKey: 'hostedZones',
  });

  const pageSize = preferences.pageSize ?? 10;
  const query = useHostedZones({
    search: search || undefined,
    type: type || undefined,
    page,
    page_size: pageSize,
    sort: SORT_FIELDS[sort] ?? 'name',
    order,
  });
  const zones = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const pagesCount = Math.max(1, Math.ceil(total / pageSize));

  // Debounced filter: typing updates the URL, the URL drives the request
  useEffect(() => {
    if (filterText === search) return;
    const timer = setTimeout(() => url.set({ search: filterText, page: undefined }), 300);
    return () => clearTimeout(timer);
  }, [filterText, search, url]);

  // Drop a selection that is no longer on the page
  useEffect(() => {
    setSelected((current) => current.filter((z) => zones.some((zone) => zone.id === z.id)));
  }, [zones]);

  const selectedZone = selected[0];
  useShortcuts({
    create: () => router.push(`${BASE}/create`),
    refresh: () => void query.refetch(),
  });

  const columnDefinitions: TableProps.ColumnDefinition<HostedZoneSummary>[] = [
    {
      id: 'name',
      width: 260,
      header: COLUMN_LABELS.name,
      sortingField: 'name',
      isRowHeader: true,
      cell: (zone) => (
        <Link href={`${BASE}/${zone.id}`} onFollow={onFollow}>
          {displayName(zone.name)}
        </Link>
      ),
    },
    {
      id: 'type',
      width: 110,
      header: COLUMN_LABELS.type,
      sortingField: 'type',
      cell: (z) => zoneTypeLabel(z.type),
    },
    { id: 'createdBy', width: 130, header: COLUMN_LABELS.createdBy, cell: (z) => z.created_by },
    {
      id: 'recordCount',
      width: 150,
      header: COLUMN_LABELS.recordCount,
      sortingField: 'recordCount',
      cell: (z) => z.record_count,
    },
    {
      id: 'description',
      width: 300,
      header: COLUMN_LABELS.description,
      sortingField: 'description',
      cell: (z) => z.description || '-',
    },
    { id: 'id', width: 260, header: COLUMN_LABELS.id, sortingField: 'id', cell: (z) => z.id },
  ];

  const filtered = Boolean(search || type);
  const clearFilters = () => url.set({ search: undefined, type: undefined, page: undefined });

  const empty = query.isError ? (
    <EmptyState
      title="Error loading hosted zones"
      subtitle={errorMessage(query.error)}
      action={<Button onClick={() => query.refetch()}>Retry</Button>}
    />
  ) : filtered ? (
    <EmptyState
      title="No matches"
      subtitle="We can't find a match."
      action={<Button onClick={clearFilters}>Clear filter</Button>}
    />
  ) : (
    <EmptyState
      title="No hosted zones"
      subtitle="You don't have any hosted zones."
      action={
        <Button href={`${BASE}/create`} onFollow={onFollow}>
          Create hosted zone
        </Button>
      }
    />
  );

  return (
    <>
      <Table
        variant="full-page"
        items={zones}
        trackBy="id"
        columnDefinitions={columnDefinitions}
        columnDisplay={preferences.contentDisplay}
        wrapLines={preferences.wrapLines}
        stripedRows={preferences.stripedRows}
        resizableColumns
        loading={query.isLoading}
        loadingText="Loading hosted zones"
        selectionType="single"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        ariaLabels={{
          selectionGroupLabel: 'Hosted zone selection',
          itemSelectionLabel: (_, zone) => displayName(zone.name),
          allItemsSelectionLabel: () => 'Select all',
        }}
        sortingColumn={{ sortingField: sort }}
        sortingDescending={order === 'desc'}
        onSortingChange={({ detail }) =>
          url.set({
            sort: detail.sortingColumn.sortingField,
            order: detail.isDescending ? 'desc' : undefined,
            page: undefined,
          })
        }
        empty={empty}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={query.data ? `(${total})` : undefined}
            info={<InfoLink helpKey="hostedZones" label="Hosted zones" />}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh hosted zones"
                  loading={query.isFetching && !query.isLoading}
                  onClick={() => query.refetch()}
                />
                <Button
                  disabled={!selectedZone}
                  href={selectedZone ? `${BASE}/${selectedZone.id}` : undefined}
                  onFollow={onFollow}
                >
                  View details
                </Button>
                <Button
                  disabled={!selectedZone}
                  href={selectedZone ? `${BASE}/${selectedZone.id}/edit` : undefined}
                  onFollow={onFollow}
                >
                  Edit
                </Button>
                <Button disabled={!selectedZone} onClick={() => setToDelete(selectedZone ?? null)}>
                  Delete
                </Button>
                <Button variant="primary" href={`${BASE}/create`} onFollow={onFollow}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <div data-shortcut-search style={{ minWidth: 280 }}>
              <TextFilter
                filteringText={filterText}
                filteringPlaceholder="Filter hosted zones by property or value"
                filteringAriaLabel="Filter hosted zones"
                countText={search ? `${total} ${total === 1 ? 'match' : 'matches'}` : undefined}
                onChange={({ detail }) => setFilterText(detail.filteringText)}
              />
            </div>
            <Select
              selectedOption={TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[0]}
              options={TYPE_OPTIONS}
              ariaLabel="Filter by type"
              onChange={({ detail }) =>
                url.set({ type: detail.selectedOption.value, page: undefined })
              }
            />
          </SpaceBetween>
        }
        pagination={
          <Pagination
            currentPageIndex={Math.min(page, pagesCount)}
            pagesCount={pagesCount}
            onChange={({ detail }) => url.set({ page: detail.currentPageIndex })}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={preferences}
            onConfirm={({ detail }) => {
              setPreferences(detail);
              url.set({ page: undefined });
            }}
            pageSizePreference={{
              title: 'Page size',
              options: [10, 25, 50, 100].map((value) => ({ value, label: `${value} zones` })),
            }}
            wrapLinesPreference={{
              label: 'Wrap lines',
              description: 'Select to see all the text and wrap the lines',
            }}
            stripedRowsPreference={{
              label: 'Striped rows',
              description: 'Select to add alternating shaded rows',
            }}
            contentDisplayPreference={{
              title: 'Column preferences',
              options: Object.entries(COLUMN_LABELS).map(([id, label]) => ({
                id,
                label,
                alwaysVisible: id === 'name',
              })),
            }}
          />
        }
      />
      <DeleteZoneModal
        zone={toDelete}
        onDismiss={() => setToDelete(null)}
        onDeleted={() => {
          setToDelete(null);
          setSelected([]);
        }}
      />
    </>
  );
}
