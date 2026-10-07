'use client';

import FormField from '@cloudscape-design/components/form-field';
import Textarea from '@cloudscape-design/components/textarea';

import { InfoLink } from '@/components/common/InfoLink';
import type { RecordType } from '@/lib/api/types';
import { recordTypeInfo } from '@/lib/route53';

interface Props {
  type: RecordType;
  value: string;
  errorText?: string;
  onChange: (value: string) => void;
}

/** The Value textarea: one value per line, placeholder and hint follow the record type. */
export function RecordValueField({ type, value, errorText, onChange }: Props) {
  const info = recordTypeInfo(type);
  return (
    <FormField
      label="Value"
      info={<InfoLink helpKey="value" label="Value" />}
      description="Enter multiple values on separate lines."
      constraintText={info.constraint}
      errorText={errorText}
      stretch
    >
      <Textarea
        value={value}
        rows={3}
        spellcheck={false}
        placeholder={info.placeholder}
        ariaLabel="Value"
        onChange={({ detail }) => onChange(detail.value)}
      />
    </FormField>
  );
}
