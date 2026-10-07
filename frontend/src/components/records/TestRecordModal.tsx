'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';

import { errorMessage, recordsApi } from '@/lib/api';
import type { HostedZoneDetail, RecordType } from '@/lib/api/types';
import { displayName } from '@/lib/format';
import { RECORD_TYPES } from '@/lib/route53';

interface Answer {
  code: 'NOERROR' | 'NXDOMAIN';
  values: string[];
}

/** "Test record": answers from the records stored in this zone, as Route 53 would. */
export function TestRecordModal({
  zone,
  visible,
  onDismiss,
}: {
  zone: HostedZoneDetail;
  visible: boolean;
  onDismiss: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RecordType>('A');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fqdn = name.trim()
    ? `${name.trim().toLowerCase().replace(/\.$/, '')}.${zone.name}`
    : zone.name;

  const test = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await recordsApi.list(zone.id, { search: fqdn, type, page_size: 100 });
      const matches = page.items.filter((r) => r.name === fqdn);
      const values = matches.flatMap((r) => (r.alias ? [`ALIAS ${r.alias.dns_name}`] : r.values));
      setAnswer({ code: matches.length ? 'NOERROR' : 'NXDOMAIN', values });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="Test record"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Close
            </Button>
            <Button variant="primary" loading={loading} onClick={() => void test()}>
              Get response
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <FormField label="Record name" description="Keep blank to test the root domain.">
          <div className="record-name-row">
            <Input
              value={name}
              placeholder="www"
              onChange={({ detail }) => setName(detail.value)}
            />
            <span className="record-name-suffix">
              <Box variant="span" color="text-body-secondary">
                .{displayName(zone.name)}
              </Box>
            </span>
          </div>
        </FormField>
        <FormField label="Type">
          <Select
            selectedOption={{ value: type, label: type }}
            options={RECORD_TYPES.map((t) => ({ value: t.type, label: t.type }))}
            onChange={({ detail }) => setType(detail.selectedOption.value as RecordType)}
          />
        </FormField>
        {error && <Box color="text-status-error">{error}</Box>}
        {answer && (
          <Container header={<Header variant="h3">Response returned by Route 53</Header>}>
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'DNS response code', value: answer.code },
                { label: 'Protocol', value: 'UDP' },
                { label: 'Query', value: `${fqdn} ${type}` },
                {
                  label: 'Response',
                  value: answer.values.length ? (
                    <div className="value-lines">
                      {answer.values.map((v, i) => (
                        <div key={`${i}-${v}`}>{v}</div>
                      ))}
                    </div>
                  ) : (
                    '-'
                  ),
                },
              ]}
            />
          </Container>
        )}
      </SpaceBetween>
    </Modal>
  );
}
