'use client';

import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { InfoLink } from '@/components/common/InfoLink';
import { errorMessage, importExportApi, useRecords } from '@/lib/api';
import type { HostedZoneDetail, RecordSet } from '@/lib/api/types';
import { useConsole, useShortcuts } from '@/lib/console';
import { ROUTING_POLICY_LABELS, differentiator, displayName, recordValueLines } from '@/lib/format';
import { useFollow } from '@/lib/navigation';
import { useNotify } from '@/lib/notifications';
import { useStoredState } from '@/lib/preferences';
import { RECORD_TYPES, ROUTING_POLICIES } from '@/lib/route53';
import { useUrlState } from '@/lib/use-url-state';

import { DeleteRecordsModal } from './DeleteRecordsModal';
import { ImportZoneFileModal } from './ImportZoneFileModal';
import { RecordDetailsPanel } from './RecordDetailsPanel';

const COLUMN_LABELS: Record<string, string> = {
  name: 'Record name',
  type: 'Type',
  routingPolicy: 'Routing policy',
  differentiator: 'Differentiator',
  alias: 'Alias',
  value: 'Value/Route traffic to',
  ttl: 'TTL (seconds)',
  healthCheck: 'Health check ID',
  evaluateHealth: 'Evaluate target health',
  recordId: 'Record ID',
};

const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences = {
  pageSize: 50,
  wrapLines: false,
  stripedRows: false,
  contentDisplay: Object.keys(COLUMN_LABELS).map((id) => ({ id, visible: true })),
};

const TYPE_OPTIONS: SelectProps.Option[] = [
  { value: '', label: 'Type' },
  ...RECORD_TYPES.map((t) => ({ value: t.type, label: t.type })),
];
const POLICY_OPTIONS: SelectProps.Option[] = [
  { value: '', label: 'Routing policy' },
  ...ROUTING_POLICIES.map((p) => ({ value: p.value, label: ROUTING_POLICY_LABELS[p.value] })),
];

const SORT_FIELDS: Record<string, string> = {
  name: 'name',
  type: 'type',
  routingPolicy: 'routing_policy',
  ttl: 'ttl',
};

function ValueCell({ record }: { record: RecordSet }) {
  return (
    <div className="value-lines">
      {recordValueLines(record).map((line, index) => (
        <div key={`${index}-${line}`}>{line}</div>
      ))}
    </div>
  );
}

export function RecordsTable({ zone }: { zone: HostedZoneDetail }) {
  const router = useRouter();
  const onFollow = useFollow();
  const notify = useNotify();
  const url = useUrlState();
  const { setSplitPanel, setSplitPanelOpen } = useConsole();
  const [preferences, setPreferences] = useStoredState('r53-records-table', DEFAULT_PREFERENCES);
  const [selected, setSelected] = useState<RecordSet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  const search = url.get('search');
  const type = url.get('type');
  const policy = url.get('policy');
  const page = Number(url.get('page')) || 1;
  const sort = url.get('sort');
  const order = url.get('order') === 'desc' ? 'desc' : 'asc';
  const [filterText, setFilterText] = useState(search);
  useEffect(() => setFilterText(search), [search]);

  const pageSize = preferences.pageSize ?? 50;
  const query = useRecords(zone.id, {
    search: search || undefined,
    type: type || undefined,
    routing_policy: policy || undefined,
    page,
    page_size: pageSize,
    sort: sort ? SORT_FIELDS[sort] : undefined,
    order,
  });
  const records = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const pagesCount = Math.max(1, Math.ceil(total / pageSize));
  const createHref = `/route53/v2/hostedzones/${zone.id}/records/create`;

  useEffect(() => {
    if (filterText === search) return;
    const timer = setTimeout(() => url.set({ search: filterText, page: undefined }), 300);
    return () => clearTimeout(timer);
  }, [filterText, search, url]);

  useEffect(() => {
    setSelected((current) => current.filter((r) => records.some((rec) => rec.id === r.id)));
  }, [records]);

  // The record-details split panel follows the clicked row
  const active = records.find((r) => r.id === activeId) ?? null;
  useEffect(() => {
    if (!active) {
      setSplitPanel(null);
      return;
    }
    setSplitPanel({
      header: `Record details: ${displayName(active.name)}`,
      content: <RecordDetailsPanel record={active} zone={zone} />,
    });
  }, [active, zone, setSplitPanel]);
  useEffect(() => () => setSplitPanel(null), [setSplitPanel]);

  useShortcuts({
    create: () => router.push(createHref),
    refresh: () => void query.refetch(),
  });

  const columnDefinitions: TableProps.ColumnDefinition<RecordSet>[] = [
    {
      id: 'name',
      width: 260,
      header: COLUMN_LABELS.name,
      sortingField: 'name',
      isRowHeader: true,
      cell: (r) => displayName(r.name),
    },
    {
      id: 'type',
      width: 90,
      header: COLUMN_LABELS.type,
      sortingField: 'type',
      cell: (r) => r.type,
    },
    {
      id: 'routingPolicy',
      width: 140,
      header: COLUMN_LABELS.routingPolicy,
      sortingField: 'routingPolicy',
      cell: (r) => ROUTING_POLICY_LABELS[r.routing_policy],
    },
    {
      id: 'differentiator',
      width: 140,
      header: COLUMN_LABELS.differentiator,
      cell: differentiator,
    },
    { id: 'alias', width: 90, header: COLUMN_LABELS.alias, cell: (r) => (r.alias ? 'Yes' : 'No') },
    { id: 'value', width: 300, header: COLUMN_LABELS.value, cell: (r) => <ValueCell record={r} /> },
    {
      id: 'ttl',
      width: 130,
      header: COLUMN_LABELS.ttl,
      sortingField: 'ttl',
      cell: (r) => (r.ttl === null ? '-' : r.ttl),
    },
    {
      id: 'healthCheck',
      width: 170,
      header: COLUMN_LABELS.healthCheck,
      cell: (r) => r.health_check_id ?? '-',
    },
    {
      id: 'evaluateHealth',
      width: 190,
      header: COLUMN_LABELS.evaluateHealth,
      cell: (r) => (r.alias ? (r.alias.evaluate_target_health ? 'Yes' : 'No') : '-'),
    },
    {
      id: 'recordId',
      width: 170,
      header: COLUMN_LABELS.recordId,
      cell: (r) => r.set_identifier ?? '-',
    },
  ];

  const exportZone = (format: 'bind' | 'json') =>
    importExportApi
      .exportZone(zone.id, format, displayName(zone.name))
      .catch((error: unknown) => notify.error(errorMessage(error), { header: 'Export failed' }));

  const filtered = Boolean(search || type || policy);
  const clearFilters = () =>
    url.set({ search: undefined, type: undefined, policy: undefined, page: undefined });

  return (
    <>
      <Table
        items={records}
        trackBy="id"
        columnDefinitions={columnDefinitions}
        columnDisplay={preferences.contentDisplay}
        wrapLines={preferences.wrapLines}
        stripedRows={preferences.stripedRows}
        resizableColumns
        loading={query.isLoading}
        loadingText="Loading records"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        onRowClick={({ detail }) => {
          setActiveId(detail.item.id);
          setSplitPanelOpen(true);
        }}
        ariaLabels={{
          selectionGroupLabel: 'Record selection',
          itemSelectionLabel: (_, r) => `${displayName(r.name)} ${r.type}`,
          allItemsSelectionLabel: () => 'Select all records on this page',
        }}
        sortingColumn={sort ? { sortingField: sort } : undefined}
        sortingDescending={order === 'desc'}
        onSortingChange={({ detail }) =>
          url.set({
            sort: detail.sortingColumn.sortingField,
            order: detail.isDescending ? 'desc' : undefined,
            page: undefined,
          })
        }
        empty={
          query.isError ? (
            <EmptyState
              title="Error loading records"
              subtitle={errorMessage(query.error)}
              action={<Button onClick={() => query.refetch()}>Retry</Button>}
            />
          ) : filtered ? (
            <EmptyState
              title="No matches"
              subtitle="We can't find a match."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              title="No records"
              subtitle="This hosted zone doesn't have any records."
              action={
                <Button href={createHref} onFollow={onFollow}>
                  Create record
                </Button>
              }
            />
          )
        }
        header={
          <Header
            counter={
              query.data
                ? selected.length
                  ? `(${selected.length}/${total})`
                  : `(${total})`
                : undefined
            }
            info={<InfoLink helpKey="records" label="Records" />}
            description="Automatic mode is the current search behavior optimized for best filter results. To change modes go to settings."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh records"
                  loading={query.isFetching && !query.isLoading}
                  onClick={() => query.refetch()}
                />
                <Button disabled={selected.length === 0} onClick={() => setDeleting(true)}>
                  Delete record
                </Button>
                <Button onClick={() => setImporting(true)}>Import zone file</Button>
                <ButtonDropdown
                  items={[
                    { id: 'bind', text: 'BIND zone file (.zone)' },
                    { id: 'json', text: 'JSON (ResourceRecordSets)' },
                  ]}
                  onItemClick={({ detail }) => exportZone(detail.id as 'bind' | 'json')}
                >
                  Export
                </ButtonDropdown>
                <Button variant="primary" href={createHref} onFollow={onFollow}>
                  Create record
                </Button>
              </SpaceBetween>
            }
          >
            Records
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <div data-shortcut-search style={{ minWidth: 280 }}>
              <TextFilter
                filteringText={filterText}
                filteringPlaceholder="Filter records by property or value"
                filteringAriaLabel="Filter records"
                countText={filtered ? `${total} ${total === 1 ? 'match' : 'matches'}` : undefined}
                onChange={({ detail }) => setFilterText(detail.filteringText)}
              />
            </div>
            <Select
              selectedOption={TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[0]}
              options={TYPE_OPTIONS}
              ariaLabel="Filter by record type"
              onChange={({ detail }) =>
                url.set({ type: detail.selectedOption.value, page: undefined })
              }
            />
            <Select
              selectedOption={POLICY_OPTIONS.find((o) => o.value === policy) ?? POLICY_OPTIONS[0]}
              options={POLICY_OPTIONS}
              ariaLabel="Filter by routing policy"
              onChange={({ detail }) =>
                url.set({ policy: detail.selectedOption.value, page: undefined })
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
              options: [10, 25, 50, 100].map((value) => ({ value, label: `${value} records` })),
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
      <DeleteRecordsModal
        zone={zone}
        records={deleting ? selected : []}
        visible={deleting}
        onDismiss={() => setDeleting(false)}
        onDeleted={() => {
          setDeleting(false);
          setSelected([]);
          setActiveId(null);
        }}
      />
      <ImportZoneFileModal zone={zone} visible={importing} onDismiss={() => setImporting(false)} />
    </>
  );
}
