/** Client-side copies of the backend's name rules, for instant feedback in forms. */

const ZONE_LABEL = /^[a-z0-9-]+$/;
const RECORD_LABEL = /^[a-z0-9_-]+$/;
const HOST_LABEL = /^[a-z0-9_-]+$/;

function labelsOf(name: string): string[] {
  const stripped = name.endsWith('.') ? name.slice(0, -1) : name;
  return stripped ? stripped.split('.') : [];
}

/** Returns an error message, or null when the hosted zone name is valid. */
export function validateZoneName(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  if (!name || name === '.') return 'Enter a domain name.';
  const labels = labelsOf(name);
  if (labels.some((l) => l === '')) {
    return "The domain name can't contain empty labels (two dots in a row).";
  }
  for (const label of labels) {
    if (label.length > 63) {
      return 'Each label in the domain name can have a maximum of 63 characters.';
    }
    if (!ZONE_LABEL.test(label)) {
      return 'The domain name can contain only the characters a-z, 0-9, - (hyphen) and . (period).';
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return "A label in the domain name can't start or end with a hyphen.";
    }
  }
  if (labels.length < 2) {
    return 'Enter a domain name with at least two labels, for example example.com. A top-level domain on its own is not allowed.';
  }
  if (labels.join('.').length + 1 > 255)
    return 'The domain name can have a maximum of 255 characters.';
  return null;
}

/** The subdomain part typed next to the zone suffix, e.g. 'www' or '*.dev'. */
export function validateRecordSubdomain(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  if (!name || name === '@') return null;
  const labels = labelsOf(name);
  if (labels.some((l) => l === '')) {
    return "The record name can't contain empty labels (two dots in a row).";
  }
  for (const [index, label] of labels.entries()) {
    if (label === '*') {
      if (index !== 0) return 'A * wildcard is allowed only as the leftmost label.';
      continue;
    }
    if (label.length > 63) {
      return 'Each label in the record name can have a maximum of 63 characters.';
    }
    if (!RECORD_LABEL.test(label)) {
      return 'The record name can contain only a-z, 0-9, - (hyphen), _ (underscore) and . (period), plus a leading * wildcard.';
    }
  }
  return null;
}

export function isValidHostname(value: string): boolean {
  const host = value.trim().toLowerCase();
  if (!host || host === '.' || host.replace(/\.$/, '').length > 253) return false;
  return labelsOf(host).every((l) => l.length > 0 && l.length <= 63 && HOST_LABEL.test(l));
}
