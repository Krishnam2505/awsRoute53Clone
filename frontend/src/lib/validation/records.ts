/**
 * The same per-type value rules the backend enforces (backend/app/validators),
 * so the form can flag a bad line before anything is sent.
 */
import type { RecordType } from '@/lib/api/types';

import { isValidHostname } from './names';

export interface ValueIssue {
  line: number; // 0-based line in the textarea, or -1 for the whole value
  message: string;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function isIPv6(value: string): boolean {
  if (!/^[0-9a-fA-F:.]+$/.test(value) || !value.includes(':')) return false;
  const doubleColon = value.split('::').length - 1;
  if (doubleColon > 1) return false;
  let groups = value.split(':');
  const last = groups[groups.length - 1];
  let expected = 8;
  if (last.includes('.')) {
    if (!IPV4.test(last)) return false;
    groups = groups.slice(0, -1);
    expected = 6;
  }
  const nonEmpty = groups.filter((g) => g !== '');
  if (nonEmpty.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return false;
  return doubleColon === 1 ? nonEmpty.length < expected : groups.length === expected;
}

function isUint(token: string, max: number): boolean {
  return /^\d+$/.test(token) && Number(token) <= max;
}

function splitQuoted(value: string): string[] | null {
  const strings: string[] = [];
  let i = 0;
  while (i < value.length) {
    if (/\s/.test(value[i])) {
      i++;
      continue;
    }
    if (value[i] !== '"') return null;
    i++;
    let current = '';
    while (i < value.length && value[i] !== '"') {
      if (value[i] === '\\' && i + 1 < value.length) {
        current += value[i + 1];
        i += 2;
        continue;
      }
      current += value[i++];
    }
    if (i >= value.length) return null;
    strings.push(current);
    i++;
  }
  return strings;
}

function checkValue(type: RecordType, value: string): string | null {
  const parts = value.split(/\s+/);
  switch (type) {
    case 'A':
      return IPV4.test(value) ? null : `The record value is not a valid IPv4 address: ${value}`;
    case 'AAAA':
      return isIPv6(value) ? null : `The record value is not a valid IPv6 address: ${value}`;
    case 'CNAME':
    case 'NS':
    case 'PTR':
      return isValidHostname(value) ? null : `The value is not a valid domain name: ${value}`;
    case 'MX':
      if (parts.length !== 2) {
        return `An MX value must be a priority and a domain name, for example 10 mail.example.com: ${value}`;
      }
      if (!isUint(parts[0], 65535))
        return 'The MX priority must be an integer between 0 and 65535.';
      return isValidHostname(parts[1])
        ? null
        : `The mail server is not a valid domain name: ${parts[1]}`;
    case 'SRV':
      if (parts.length !== 4) {
        return `An SRV value must be priority, weight, port and target, for example 10 5 80 hostname.example.com: ${value}`;
      }
      if (!parts.slice(0, 3).every((p) => isUint(p, 65535))) {
        return 'SRV priority, weight and port must be integers between 0 and 65535.';
      }
      return isValidHostname(parts[3])
        ? null
        : `The SRV target is not a valid domain name: ${parts[3]}`;
    case 'CAA': {
      const match = /^(\S+)\s+(\S+)\s+(.+)$/.exec(value);
      if (!match) {
        return `A CAA value must be flags, tag and value, for example 0 issue "ca.example.net": ${value}`;
      }
      if (!isUint(match[1], 255)) return 'The CAA flags must be an integer between 0 and 255.';
      if (!['issue', 'issuewild', 'iodef'].includes(match[2].toLowerCase())) {
        return `The CAA tag must be issue, issuewild or iodef: ${match[2]}`;
      }
      if (match[3].startsWith('"') && splitQuoted(match[3])?.length !== 1) {
        return `The CAA value must be one quoted string: ${value}`;
      }
      return null;
    }
    case 'TXT': {
      const strings = value.startsWith('"') ? splitQuoted(value) : [value];
      if (strings === null) return `The TXT value has unbalanced quotation marks: ${value}`;
      if (strings.some((s) => s.length > 255)) {
        return 'Each string in a TXT value can have a maximum of 255 characters. Split longer text into several quoted strings.';
      }
      return value.length > 4000 ? 'A TXT value can have a maximum of 4,000 characters.' : null;
    }
    case 'SOA':
      if (parts.length !== 7) {
        return 'An SOA value must have seven fields: primary name server, administrator email, serial number, refresh time, retry time, expire time and minimum TTL.';
      }
      if (!isValidHostname(parts[0]) || !isValidHostname(parts[1])) {
        return 'The SOA name server and email must be valid domain names.';
      }
      return parts.slice(2).every((p) => isUint(p, 4294967295))
        ? null
        : 'The last five SOA fields must be integers.';
    default:
      return null;
  }
}

/** Split the textarea into values: one per line, blank lines ignored. */
export function valuesFromText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateRecordValues(type: RecordType, text: string): ValueIssue[] {
  const values = valuesFromText(text);
  if (values.length === 0) return [{ line: -1, message: 'Enter a value for the record.' }];
  if ((type === 'CNAME' || type === 'SOA') && values.length > 1) {
    return [{ line: -1, message: `A ${type} record can have only one value.` }];
  }
  const issues: ValueIssue[] = [];
  values.forEach((value, line) => {
    const message = checkValue(type, value);
    if (message) issues.push({ line, message });
  });
  return issues;
}

export const MAX_TTL = 2147483647;

export function validateTtl(raw: string): string | null {
  if (!/^\d+$/.test(raw.trim())) return 'Enter a TTL in seconds, as a whole number.';
  const ttl = Number(raw);
  return ttl > MAX_TTL ? `TTL must be between 0 and ${MAX_TTL} seconds.` : null;
}
