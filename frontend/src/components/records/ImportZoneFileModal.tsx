'use client';

import { useCollection } from '@cloudscape-design/collection-hooks';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FileUpload from '@cloudscape-design/components/file-upload';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import Textarea from '@cloudscape-design/components/textarea';
import { useState } from 'react';

import { InfoLink } from '@/components/common/InfoLink';
import { errorMessage, useImportZoneFile } from '@/lib/api';
import type { HostedZoneDetail, ImportResult, RecordSetCreate } from '@/lib/api/types';
import { displayName } from '@/lib/format';
import { useNotify } from '@/lib/notifications';

interface Props {
  zone: HostedZoneDetail;
  visible: boolean;
  onDismiss: () => void;
}

function PreviewTable({ result }: { result: ImportResult }) {
  const { items, collectionProps, paginationProps } = useCollection<RecordSetCreate>(
    result.record_sets,
    { pagination: { pageSize: 10 }, sorting: {} },
  );
  return (
    <Table
      {...collectionProps}
      variant="embedded"
      items={items}
      header={
        <Header
          counter={`(${result.record_sets.length})`}
          description={`${result.skipped} apex SOA/NS record(s) skipped.`}
        >
          Records to import
        </Header>
      }
      columnDefinitions={[
        {
          id: 'name',
          header: 'Record name',
          cell: (r) => displayName(r.name ?? ''),
          sortingField: 'name',
        },
        { id: 'type', header: 'Type', cell: (r) => r.type, sortingField: 'type' },
        { id: 'ttl', header: 'TTL (seconds)', cell: (r) => r.ttl ?? '-' },
        {
          id: 'value',
          header: 'Value',
          cell: (r) => (
            <div className="value-lines">
              {(r.values ?? []).map((v, i) => (
                <div key={`${i}-${v}`}>{v}</div>
              ))}
            </div>
          ),
        },
      ]}
      empty={<Box textAlign="center">No records found in the zone file.</Box>}
      pagination={<Pagination {...paginationProps} />}
      wrapLines
    />
  );
}

/** Bonus: BIND zone-file import with a dry-run preview, committed as one change batch. */
export function ImportZoneFileModal({ zone, visible, onDismiss }: Props) {
  const notify = useNotify();
  const importer = useImportZoneFile(zone.id);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<ImportResult | null>(null);

  const close = () => {
    setPreview(null);
    importer.reset();
    onDismiss();
  };

  const loadFile = async (picked: File[]) => {
    setFiles(picked);
    setPreview(null);
    if (picked[0]) setText(await picked[0].text());
  };

  const runPreview = () =>
    importer.mutate(
      { zoneFile: text, dryRun: true },
      { onSuccess: (result) => setPreview(result) },
    );

  const commit = () =>
    importer.mutate(
      { zoneFile: text, dryRun: false },
      {
        onSuccess: (result) => {
          if (result.errors.length > 0 || !result.change) {
            setPreview(result);
            return;
          }
          notify.success(
            `${result.record_sets.length} record(s) were successfully imported into ${displayName(zone.name)}. Change ID: ${result.change.id}.`,
          );
          setText('');
          setFiles([]);
          close();
        },
      },
    );

  const canImport =
    preview !== null && preview.errors.length === 0 && preview.record_sets.length > 0;

  return (
    <Modal
      visible={visible}
      onDismiss={close}
      size="large"
      header={
        <Header variant="h2" info={<InfoLink helpKey="importZoneFile" label="Import zone file" />}>
          Import zone file
        </Header>
      }
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={runPreview}
              disabled={!text.trim()}
              loading={importer.isPending && !preview}
            >
              Preview
            </Button>
            <Button
              variant="primary"
              onClick={commit}
              disabled={!canImport}
              loading={importer.isPending && preview !== null}
            >
              Import
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <FormField
          label="Zone file"
          description={`Paste records in BIND zone-file format. Relative names are relative to ${displayName(zone.name)}.`}
        >
          <Textarea
            value={text}
            rows={12}
            spellcheck={false}
            placeholder={`$ORIGIN ${zone.name}\n$TTL 300\nwww   IN A     192.0.2.1\nmail  IN MX    10 mail.example.com.`}
            onChange={({ detail }) => {
              setText(detail.value);
              setPreview(null);
            }}
          />
        </FormField>
        <FormField label="Or upload a file">
          <FileUpload
            value={files}
            onChange={({ detail }) => void loadFile(detail.value)}
            accept=".zone,.txt,.db,text/plain"
            constraintText="A text file in BIND format."
          />
        </FormField>
        {importer.isError && <Alert type="error">{errorMessage(importer.error)}</Alert>}
        {preview && preview.errors.length > 0 && (
          <Alert type="error" header={`${preview.errors.length} line(s) couldn't be imported`}>
            <ul>
              {preview.errors.map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
            Fix these lines, then choose Preview again.
          </Alert>
        )}
        {preview && <PreviewTable result={preview} />}
      </SpaceBetween>
    </Modal>
  );
}
