'use client';

import Alert from '@cloudscape-design/components/alert';
import AttributeEditor from '@cloudscape-design/components/attribute-editor';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TagEditor, { type TagEditorProps } from '@cloudscape-design/components/tag-editor';
import Textarea from '@cloudscape-design/components/textarea';
import Tiles from '@cloudscape-design/components/tiles';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';

import { InfoLink } from '@/components/common/InfoLink';
import { errorMessage, fieldErrorMap, useCreateHostedZone, useUpdateHostedZone } from '@/lib/api';
import type { HostedZoneDetail, ZoneType } from '@/lib/api/types';
import { displayName } from '@/lib/format';
import { usePageSetup } from '@/lib/console';
import { useFollow } from '@/lib/navigation';
import { useNotify } from '@/lib/notifications';
import { AWS_REGIONS, mockVpcsFor, regionLabel } from '@/lib/route53';
import { validateZoneName } from '@/lib/validation/names';

const BASE = '/route53/v2/hostedzones';
const MAX_DESCRIPTION = 256;

interface VpcRow {
  region: string;
  vpcId: string;
}

type Props = { mode: 'create' } | { mode: 'edit'; zone: HostedZoneDetail };

const REGION_OPTIONS = AWS_REGIONS.map((r) => ({
  value: r.code,
  label: r.name,
  description: r.code,
}));

function vpcOptions(region: string, current: string) {
  const options = region
    ? mockVpcsFor(region).map((v) => ({ value: v.id, label: v.id, description: v.name }))
    : [];
  if (current && !options.some((o) => o.value === current)) {
    options.unshift({ value: current, label: current, description: 'associated' });
  }
  return options;
}

/** Create hosted zone, and Edit hosted zone (description and VPCs only, as in Route53). */
export function HostedZoneForm(props: Props) {
  const router = useRouter();
  const onFollow = useFollow();
  const notify = useNotify();
  const editing = props.mode === 'edit' ? props.zone : null;

  usePageSetup({
    breadcrumbs: editing
      ? [
          { text: 'Hosted zones', href: BASE },
          { text: displayName(editing.name), href: `${BASE}/${editing.id}` },
          { text: 'Edit hosted zone', href: `${BASE}/${editing.id}/edit` },
        ]
      : [
          { text: 'Hosted zones', href: BASE },
          { text: 'Create hosted zone', href: `${BASE}/create` },
        ],
    contentType: 'form',
    helpKey: 'createHostedZone',
  });

  const [name, setName] = useState(editing ? displayName(editing.name) : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [type, setType] = useState<ZoneType>(editing?.type ?? 'public');
  const [vpcs, setVpcs] = useState<VpcRow[]>(
    editing?.vpcs.map((v) => ({ region: v.region, vpcId: v.vpc_id })) ?? [
      { region: 'us-east-1', vpcId: '' },
    ],
  );
  const [tags, setTags] = useState<TagEditorProps.Tag[]>([]);
  const [touched, setTouched] = useState(false);

  const create = useCreateHostedZone();
  const update = useUpdateHostedZone(editing?.id ?? '');
  const mutation = editing ? update : create;
  const serverErrors = useMemo(() => fieldErrorMap(mutation.error), [mutation.error]);

  const clientErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!editing) {
      const nameError = validateZoneName(name);
      if (nameError) errors.name = nameError;
    }
    if (description.length > MAX_DESCRIPTION) {
      errors.description = `The description can have a maximum of ${MAX_DESCRIPTION} characters.`;
    }
    if (type === 'private') {
      if (vpcs.length === 0) {
        errors.vpcs = 'A private hosted zone must be associated with at least one VPC.';
      }
      vpcs.forEach((vpc, index) => {
        if (!vpc.region) errors[`vpcs[${index}].region`] = 'Choose a Region.';
        if (!vpc.vpcId) errors[`vpcs[${index}].vpc_id`] = 'Choose a VPC.';
      });
    }
    return errors;
  }, [description, editing, name, type, vpcs]);

  const errorFor = (field: string) =>
    (touched ? clientErrors[field] : undefined) ?? serverErrors[field];
  const cancelHref = editing ? `${BASE}/${editing.id}` : BASE;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setTouched(true);
    if (Object.keys(clientErrors).length > 0) return;
    const vpcBody = vpcs.map((v) => ({ region: v.region, vpc_id: v.vpcId }));

    if (editing) {
      update.mutate(
        {
          description: description.trim() || null,
          ...(editing.type === 'private' ? { vpcs: vpcBody } : {}),
        },
        {
          onSuccess: () => {
            notify.success(
              `The hosted zone ${displayName(editing.name)} was successfully updated.`,
              {
                persist: true,
              },
            );
            router.push(`${BASE}/${editing.id}`);
          },
        },
      );
      return;
    }

    create.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        type,
        vpcs: type === 'private' ? vpcBody : [],
        tags: tags
          .filter((t) => !t.markedForRemoval && t.key.trim())
          .map((t) => ({ key: t.key.trim(), value: t.value.trim() })),
      },
      {
        onSuccess: ({ hosted_zone: zone }) => {
          notify.success(
            `${displayName(zone.name)} was successfully created. Now you can create records in the hosted zone to specify how you want Route 53 to route traffic for your domain.`,
            { persist: true },
          );
          router.push(`${BASE}/${zone.id}`);
        },
      },
    );
  };

  const generalError =
    mutation.isError && Object.keys(serverErrors).length === 0
      ? errorMessage(mutation.error)
      : null;

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={<InfoLink helpKey="createHostedZone" label="hosted zones" />}>
          {editing ? 'Edit hosted zone' : 'Create hosted zone'}
        </Header>
      }
    >
      <form onSubmit={submit} noValidate>
        <Form
          errorText={generalError}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" href={cancelHref} onFollow={onFollow} formAction="none">
                Cancel
              </Button>
              <Button variant="primary" formAction="submit" loading={mutation.isPending}>
                {editing ? 'Save changes' : 'Create hosted zone'}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Container
              header={
                <Header
                  variant="h2"
                  description={
                    editing
                      ? undefined
                      : 'A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains.'
                  }
                >
                  Hosted zone configuration
                </Header>
              }
            >
              <SpaceBetween size="l">
                <FormField
                  label="Domain name"
                  info={<InfoLink helpKey="domainName" label="Domain name" />}
                  description="This is the name of the domain that you want to route traffic for."
                  constraintText={
                    editing
                      ? "You can't change the domain name of a hosted zone."
                      : 'Valid characters: a-z, 0-9, - (hyphen) and . (period). Each label can have up to 63 characters.'
                  }
                  errorText={errorFor('name')}
                >
                  <Input
                    value={name}
                    placeholder="example.com"
                    disabled={!!editing}
                    autoFocus={!editing}
                    onChange={({ detail }) => setName(detail.value)}
                  />
                </FormField>

                <FormField
                  label={
                    <>
                      Description <i>- optional</i>
                    </>
                  }
                  info={<InfoLink helpKey="description" label="Description" />}
                  description="This value lets you distinguish hosted zones that have the same name."
                  constraintText={`The description can have up to ${MAX_DESCRIPTION} characters. ${description.length}/${MAX_DESCRIPTION}`}
                  errorText={errorFor('description')}
                >
                  <Textarea
                    value={description}
                    rows={3}
                    placeholder="The hosted zone is used for..."
                    onChange={({ detail }) => setDescription(detail.value)}
                  />
                </FormField>

                <FormField
                  label="Type"
                  info={<InfoLink helpKey="zoneType" label="Type" />}
                  description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC."
                  constraintText={
                    editing ? "You can't change the type of a hosted zone." : undefined
                  }
                >
                  <Tiles
                    value={type}
                    onChange={({ detail }) => setType(detail.value as ZoneType)}
                    columns={2}
                    items={[
                      {
                        value: 'public',
                        label: 'Public hosted zone',
                        description:
                          'A public hosted zone determines how traffic is routed on the internet.',
                        disabled: !!editing,
                      },
                      {
                        value: 'private',
                        label: 'Private hosted zone',
                        description:
                          'A private hosted zone determines how traffic is routed within an Amazon VPC.',
                        disabled: !!editing,
                      },
                    ]}
                  />
                </FormField>
              </SpaceBetween>
            </Container>

            {type === 'private' && (
              <Container
                header={
                  <Header
                    variant="h2"
                    info={<InfoLink helpKey="vpcs" label="VPCs" />}
                    description="To use this hosted zone to resolve DNS queries for one or more VPCs, choose the VPCs. VPCs in this console clone are simulated."
                  >
                    VPCs to associate with the hosted zone
                  </Header>
                }
              >
                <SpaceBetween size="s">
                  <AttributeEditor
                    items={vpcs}
                    addButtonText="Add VPC"
                    removeButtonText="Remove VPC"
                    empty="No VPCs associated with the hosted zone."
                    onAddButtonClick={() => setVpcs([...vpcs, { region: 'us-east-1', vpcId: '' }])}
                    onRemoveButtonClick={({ detail }) =>
                      setVpcs(vpcs.filter((_, index) => index !== detail.itemIndex))
                    }
                    definition={[
                      {
                        label: 'Region',
                        errorText: (_, index) => errorFor(`vpcs[${index}].region`),
                        control: (item, index) => (
                          <Select
                            selectedOption={
                              item.region
                                ? { value: item.region, label: regionLabel(item.region) }
                                : null
                            }
                            options={REGION_OPTIONS}
                            placeholder="Choose a Region"
                            filteringType="auto"
                            onChange={({ detail }) =>
                              setVpcs(
                                vpcs.map((v, i) =>
                                  i === index
                                    ? { region: detail.selectedOption.value ?? '', vpcId: '' }
                                    : v,
                                ),
                              )
                            }
                          />
                        ),
                      },
                      {
                        label: 'VPC ID',
                        errorText: (_, index) => errorFor(`vpcs[${index}].vpc_id`),
                        control: (item, index) => (
                          <Select
                            selectedOption={
                              item.vpcId ? { value: item.vpcId, label: item.vpcId } : null
                            }
                            options={vpcOptions(item.region, item.vpcId)}
                            placeholder="Choose VPC"
                            empty="Choose a Region first"
                            onChange={({ detail }) =>
                              setVpcs(
                                vpcs.map((v, i) =>
                                  i === index
                                    ? { ...v, vpcId: detail.selectedOption.value ?? '' }
                                    : v,
                                ),
                              )
                            }
                          />
                        ),
                      },
                    ]}
                  />
                  {errorFor('vpcs') && (
                    <Alert type="error" statusIconAriaLabel="Error">
                      {errorFor('vpcs')}
                    </Alert>
                  )}
                </SpaceBetween>
              </Container>
            )}

            {!editing && (
              <Container
                header={
                  <Header
                    variant="h2"
                    info={<InfoLink helpKey="tags" label="Tags" />}
                    description="Apply tags to hosted zones to help organize and identify them."
                  >
                    Tags
                  </Header>
                }
              >
                <TagEditor
                  tags={tags}
                  onChange={({ detail }) => setTags([...detail.tags])}
                  tagLimit={50}
                />
                {serverErrors.tags && (
                  <Box color="text-status-error" margin={{ top: 'xs' }}>
                    {serverErrors.tags}
                  </Box>
                )}
              </Container>
            )}
          </SpaceBetween>
        </Form>
      </form>
    </ContentLayout>
  );
}
