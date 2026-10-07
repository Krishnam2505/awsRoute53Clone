'use client';

import Autosuggest from '@cloudscape-design/components/autosuggest';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Toggle from '@cloudscape-design/components/toggle';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';

import { InfoLink } from '@/components/common/InfoLink';
import {
  ApiError,
  errorMessage,
  fieldErrorMap,
  useChangeBatch,
  useRecords,
  useUpdateRecord,
} from '@/lib/api';
import type { HostedZoneDetail, RecordSet, RecordType, RoutingPolicy } from '@/lib/api/types';
import { displayName } from '@/lib/format';
import { usePageSetup } from '@/lib/console';
import { useFollow } from '@/lib/navigation';
import { useNotify } from '@/lib/notifications';
import {
  ALIAS_ENDPOINTS,
  AWS_REGIONS,
  type AliasEndpoint,
  CREATABLE_RECORD_TYPES,
  RECORD_TYPES,
  ROUTING_POLICIES,
  recordTypeInfo,
  regionLabel,
} from '@/lib/route53';

import {
  type DraftErrors,
  type RecordDraft,
  draftFromRecord,
  draftToPayload,
  emptyDraft,
  validateDraft,
  valueErrorText,
} from './record-draft';
import { RecordValueField } from './RecordValueField';

const TTL_PRESETS: [string, number][] = [
  ['1m', 60],
  ['1h', 3600],
  ['1d', 86400],
];

const ALIAS_TYPES: RecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'PTR', 'SRV', 'CAA'];

function typeOption(type: RecordType): SelectProps.Option {
  return { value: type, label: `${type} – ${recordTypeInfo(type).description}` };
}

const POLICY_OPTIONS: SelectProps.Option[] = ROUTING_POLICIES.map((p) => ({
  value: p.value,
  label: p.label,
  description: p.supported ? p.description : `${p.description} Not available in this clone.`,
  disabled: !p.supported,
}));

const REGION_OPTIONS: SelectProps.Option[] = AWS_REGIONS.map((r) => ({
  value: r.code,
  label: r.name,
  description: r.code,
}));

interface FieldsProps {
  zone: HostedZoneDetail;
  draft: RecordDraft;
  errors: DraftErrors;
  locked: boolean;
  isDefault: boolean;
  index: number;
  count: number;
  onChange: (draft: RecordDraft) => void;
  onRemove: () => void;
}

function RecordFields({
  zone,
  draft,
  errors,
  locked,
  isDefault,
  index,
  count,
  onChange,
  onRemove,
}: FieldsProps) {
  const set = <K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const zoneLabel = displayName(zone.name);
  const endpoint =
    ALIAS_ENDPOINTS.find((e) => e.value === draft.aliasEndpoint) ?? ALIAS_ENDPOINTS[0];

  // Suggestions for "Alias to another record in this hosted zone"
  const zoneRecords = useRecords(
    zone.id,
    { page_size: 100 },
    { enabled: draft.alias && draft.aliasEndpoint === 'zone' },
  );
  const zoneSuggestions = (zoneRecords.data?.items ?? [])
    .filter((r) => !r.alias && r.type === draft.type)
    .map((r) => ({ value: displayName(r.name), description: r.type }));

  const typeOptions = (locked ? RECORD_TYPES : CREATABLE_RECORD_TYPES).map((t) =>
    typeOption(t.type),
  );
  const nonSimple = draft.routingPolicy !== 'SIMPLE';

  return (
    <SpaceBetween size="l">
      {count > 1 && (
        <Header
          variant="h3"
          actions={
            <Button onClick={onRemove} ariaLabel={`Remove record ${index + 1}`}>
              Delete
            </Button>
          }
        >
          Record {index + 1}
        </Header>
      )}
      <Grid
        gridDefinition={[{ colspan: { default: 12, s: 7 } }, { colspan: { default: 12, s: 5 } }]}
      >
        <FormField
          label="Record name"
          info={<InfoLink helpKey="recordName" label="Record name" />}
          constraintText={
            locked
              ? "You can't change the record name."
              : 'Keep blank to create a record for the root domain.'
          }
          errorText={errors.name}
        >
          <div className="record-name-row">
            <Input
              value={draft.name}
              placeholder="subdomain"
              disabled={locked}
              ariaLabel="Record name"
              onChange={({ detail }) => set('name', detail.value)}
            />
            <span className="record-name-suffix">
              <Box variant="span" color="text-body-secondary">
                {draft.name.trim() ? `.${zoneLabel}` : zoneLabel}
              </Box>
            </span>
          </div>
        </FormField>
        <FormField
          label="Record type"
          info={<InfoLink helpKey="recordType" label="Record type" />}
          errorText={errors.type}
        >
          <Select
            selectedOption={typeOption(draft.type)}
            options={typeOptions}
            disabled={locked}
            ariaLabel="Record type"
            onChange={({ detail }) => {
              const type = detail.selectedOption.value as RecordType;
              onChange({ ...draft, type, alias: draft.alias && ALIAS_TYPES.includes(type) });
            }}
          />
        </FormField>
      </Grid>

      <FormField
        label="Alias"
        info={<InfoLink helpKey="alias" label="Alias" />}
        description={
          ALIAS_TYPES.includes(draft.type)
            ? undefined
            : `Alias records aren't available for ${draft.type} records.`
        }
      >
        <Toggle
          checked={draft.alias}
          disabled={isDefault || !ALIAS_TYPES.includes(draft.type)}
          onChange={({ detail }) => set('alias', detail.checked)}
        >
          Alias
        </Toggle>
      </FormField>

      {draft.alias ? (
        <SpaceBetween size="l">
          <FormField
            label="Route traffic to"
            description="Choose the endpoint type, then the resource to route traffic to."
            errorText={errors['alias.dns_name'] ?? errors.alias}
            stretch
          >
            <ColumnLayout columns={endpoint.needsRegion ? 3 : 2}>
              <Select
                selectedOption={{ value: endpoint.value, label: endpoint.label }}
                options={ALIAS_ENDPOINTS.map((e) => ({ value: e.value, label: e.label }))}
                ariaLabel="Endpoint type"
                onChange={({ detail }) =>
                  onChange({
                    ...draft,
                    aliasEndpoint: detail.selectedOption.value as AliasEndpoint,
                    aliasTarget: '',
                  })
                }
              />
              {endpoint.needsRegion && (
                <Select
                  selectedOption={{
                    value: draft.aliasRegion,
                    label: regionLabel(draft.aliasRegion),
                  }}
                  options={REGION_OPTIONS}
                  filteringType="auto"
                  ariaLabel="Region"
                  onChange={({ detail }) =>
                    set('aliasRegion', detail.selectedOption.value ?? 'us-east-1')
                  }
                />
              )}
              <Autosuggest
                value={draft.aliasTarget}
                options={draft.aliasEndpoint === 'zone' ? zoneSuggestions : []}
                placeholder={endpoint.placeholder}
                enteredTextLabel={(value) => `Use: "${value}"`}
                empty="Enter the DNS name of the resource"
                ariaLabel="Alias target"
                onChange={({ detail }) => set('aliasTarget', detail.value)}
              />
            </ColumnLayout>
          </FormField>
          <FormField label="Evaluate target health">
            <Toggle
              checked={draft.evaluateTargetHealth}
              onChange={({ detail }) => set('evaluateTargetHealth', detail.checked)}
            >
              {draft.evaluateTargetHealth ? 'Yes' : 'No'}
            </Toggle>
          </FormField>
        </SpaceBetween>
      ) : (
        <RecordValueField
          type={draft.type}
          value={draft.value}
          errorText={valueErrorText(errors)}
          onChange={(value) => set('value', value)}
        />
      )}

      <Grid
        gridDefinition={[{ colspan: { default: 12, s: 6 } }, { colspan: { default: 12, s: 6 } }]}
      >
        {draft.alias ? (
          <FormField
            label="TTL (seconds)"
            description="Alias records don't have a TTL. Route 53 uses the TTL of the target."
          >
            <Input value="" disabled placeholder="-" ariaLabel="TTL (seconds)" />
          </FormField>
        ) : (
          <FormField
            label="TTL (seconds)"
            info={<InfoLink helpKey="ttl" label="TTL" />}
            constraintText="Recommended values: 60 to 172800 (two days)"
            errorText={errors.ttl}
          >
            <SpaceBetween direction="horizontal" size="xs">
              <Input
                type="number"
                inputMode="numeric"
                value={draft.ttl}
                ariaLabel="TTL (seconds)"
                onChange={({ detail }) => set('ttl', detail.value)}
              />
              {TTL_PRESETS.map(([label, seconds]) => (
                <Button key={label} formAction="none" onClick={() => set('ttl', String(seconds))}>
                  {label}
                </Button>
              ))}
            </SpaceBetween>
          </FormField>
        )}
        <FormField
          label="Routing policy"
          info={<InfoLink helpKey="routingPolicy" label="Routing policy" />}
          errorText={errors.routing_policy}
        >
          <Select
            selectedOption={POLICY_OPTIONS.find((o) => o.value === draft.routingPolicy) ?? null}
            options={POLICY_OPTIONS}
            disabled={isDefault}
            ariaLabel="Routing policy"
            onChange={({ detail }) =>
              set('routingPolicy', detail.selectedOption.value as RoutingPolicy)
            }
          />
        </FormField>
      </Grid>

      {nonSimple && (
        <ColumnLayout columns={3}>
          {draft.routingPolicy === 'WEIGHTED' && (
            <FormField
              label="Weight"
              description="0 to 255. Specify 0 to stop routing traffic to this resource."
              errorText={errors.weight}
            >
              <Input
                type="number"
                value={draft.weight}
                placeholder="0"
                onChange={({ detail }) => set('weight', detail.value)}
              />
            </FormField>
          )}
          {draft.routingPolicy === 'LATENCY' && (
            <FormField label="Region" errorText={errors.region}>
              <Select
                selectedOption={
                  draft.region ? { value: draft.region, label: regionLabel(draft.region) } : null
                }
                options={REGION_OPTIONS}
                filteringType="auto"
                placeholder="Choose a Region"
                onChange={({ detail }) => set('region', detail.selectedOption.value ?? '')}
              />
            </FormField>
          )}
          {draft.routingPolicy === 'FAILOVER' && (
            <FormField label="Failover record type" errorText={errors.failover}>
              <Select
                selectedOption={
                  draft.failover
                    ? {
                        value: draft.failover,
                        label: draft.failover === 'PRIMARY' ? 'Primary' : 'Secondary',
                      }
                    : null
                }
                options={[
                  { value: 'PRIMARY', label: 'Primary' },
                  { value: 'SECONDARY', label: 'Secondary' },
                ]}
                placeholder="Choose failover record type"
                onChange={({ detail }) =>
                  set('failover', (detail.selectedOption.value ?? '') as RecordDraft['failover'])
                }
              />
            </FormField>
          )}
          <FormField
            label={
              <>
                Health check ID <i>- optional</i>
              </>
            }
            errorText={errors.health_check_id}
          >
            <Input
              value={draft.healthCheckId}
              placeholder="abcdef11-2222-3333-4444-555555fedcba"
              onChange={({ detail }) => set('healthCheckId', detail.value)}
            />
          </FormField>
          <FormField
            label="Record ID"
            description="Enter a description that is unique for this record name and type."
            errorText={errors.set_identifier}
          >
            <Input
              value={draft.setIdentifier}
              placeholder="Production server 1"
              onChange={({ detail }) => set('setIdentifier', detail.value)}
            />
          </FormField>
        </ColumnLayout>
      )}
    </SpaceBetween>
  );
}

type Props =
  | { mode: 'create'; zone: HostedZoneDetail }
  | { mode: 'edit'; zone: HostedZoneDetail; record: RecordSet };

const PROPAGATION =
  'Route 53 propagates your changes to all of the Route 53 authoritative DNS servers within 60 seconds.';

/** Quick create (one or more records in a single change batch) and Edit record. */
export function RecordForm(props: Props) {
  const { zone } = props;
  const router = useRouter();
  const onFollow = useFollow();
  const notify = useNotify();
  const editing = props.mode === 'edit' ? props.record : null;
  const zoneHref = `/route53/v2/hostedzones/${zone.id}`;

  usePageSetup({
    breadcrumbs: [
      { text: 'Hosted zones', href: '/route53/v2/hostedzones' },
      { text: displayName(zone.name), href: zoneHref },
      editing
        ? { text: 'Edit record', href: `${zoneHref}/records/${editing.id}/edit` }
        : { text: 'Create record', href: `${zoneHref}/records/create` },
    ],
    contentType: 'form',
    helpKey: 'quickCreate',
  });

  const [drafts, setDrafts] = useState<RecordDraft[]>(() =>
    editing ? [draftFromRecord(editing, zone)] : [emptyDraft()],
  );
  const [submitted, setSubmitted] = useState(false);
  const batch = useChangeBatch(zone.id);
  const update = useUpdateRecord(zone.id, editing?.id ?? '');
  const mutation = editing ? update : batch;

  const clientErrors = useMemo(() => drafts.map((d) => validateDraft(d, zone)), [drafts, zone]);
  const serverErrors = useMemo(
    () =>
      drafts.map((_, index) =>
        editing
          ? fieldErrorMap(mutation.error)
          : fieldErrorMap(mutation.error, `changes[${index}].record_set.`),
      ),
    [drafts, editing, mutation.error],
  );

  const errorsFor = (index: number): DraftErrors => ({
    ...serverErrors[index],
    ...(submitted ? clientErrors[index] : {}),
  });

  const hasFieldErrors = serverErrors.some((e) => Object.keys(e).length > 0);
  const formError =
    mutation.error instanceof ApiError && !hasFieldErrors
      ? errorMessage(mutation.error)
      : undefined;

  const updateDraft = (index: number, draft: RecordDraft) => {
    if (mutation.isError) mutation.reset();
    setDrafts((current) => current.map((d, i) => (i === index ? draft : d)));
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setSubmitted(true);
    if (clientErrors.some((e) => Object.keys(e).length > 0)) return;
    const payloads = drafts.map((d) => draftToPayload(d, zone));

    if (editing) {
      const { ttl, values, routing_policy, set_identifier, weight, region, failover } = payloads[0];
      const fields = { ttl, values, routing_policy, set_identifier, weight, region, failover };
      update.mutate(
        { ...fields, health_check_id: payloads[0].health_check_id, alias: payloads[0].alias },
        {
          onSuccess: ({ record_set: record, change }) => {
            notify.success(
              `Record for ${displayName(record.name)} was successfully updated. ${PROPAGATION} Change ID: ${change.id}.`,
              { persist: true },
            );
            router.push(zoneHref);
          },
        },
      );
      return;
    }

    batch.mutate(
      {
        comment: payloads.length > 1 ? `Create ${payloads.length} records` : null,
        changes: payloads.map((record_set) => ({ action: 'CREATE' as const, record_set })),
      },
      {
        onSuccess: (change) => {
          const first = drafts[0].name.trim();
          const what =
            drafts.length === 1
              ? `Record for ${first ? `${first}.` : ''}${displayName(zone.name)} was`
              : `${drafts.length} records for ${displayName(zone.name)} were`;
          notify.success(`${what} successfully created. ${PROPAGATION} Change ID: ${change.id}.`, {
            persist: true,
          });
          router.push(zoneHref);
        },
      },
    );
  };

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={<InfoLink helpKey="quickCreate" label="records" />}>
          {editing ? 'Edit record' : 'Create record'}
        </Header>
      }
    >
      <form onSubmit={submit} noValidate>
        <Form
          errorText={formError}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" href={zoneHref} onFollow={onFollow} formAction="none">
                Cancel
              </Button>
              <Button variant="primary" formAction="submit" loading={mutation.isPending}>
                {editing ? 'Save' : 'Create records'}
              </Button>
            </SpaceBetween>
          }
        >
          <Container
            header={
              <Header
                variant="h2"
                info={<InfoLink helpKey="quickCreate" label="Quick create record" />}
                actions={
                  editing ? undefined : (
                    <Link
                      onFollow={() =>
                        notify.info(
                          "The record creation wizard isn't available in this Route 53 console clone.",
                        )
                      }
                    >
                      Switch to wizard
                    </Link>
                  )
                }
              >
                {editing ? 'Record' : 'Quick create record'}
              </Header>
            }
          >
            <SpaceBetween size="xl">
              {drafts.map((draft, index) => (
                <RecordFields
                  key={draft.key}
                  zone={zone}
                  draft={draft}
                  errors={errorsFor(index)}
                  locked={!!editing}
                  isDefault={!!editing?.is_default}
                  index={index}
                  count={drafts.length}
                  onChange={(d) => updateDraft(index, d)}
                  onRemove={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                />
              ))}
              {!editing && (
                <Button
                  formAction="none"
                  iconName="add-plus"
                  onClick={() => setDrafts((current) => [...current, emptyDraft()])}
                >
                  Add another record
                </Button>
              )}
            </SpaceBetween>
          </Container>
        </Form>
      </form>
    </ContentLayout>
  );
}
