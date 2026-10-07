"""BIND zone-file parsing (import) and serialising (export).

Parsing uses dnspython. To report errors per line instead of stopping at the
first one, the file is split into logical entries (joining parenthesised
multi-line records) and each entry is parsed on its own with the $ORIGIN and
$TTL in force at that point.
"""

from collections import OrderedDict
from dataclasses import dataclass, field

import dns.exception
import dns.name
import dns.rdatatype
import dns.zone

from app.models import RecordSet
from app.utils.names import display_name

SUPPORTED_TYPES = ("A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA")
DEFAULT_TTL = 300


@dataclass
class ParsedRecordSet:
    name: str
    type: str
    ttl: int
    values: list[str]
    line: int


@dataclass
class ParseResult:
    record_sets: list[ParsedRecordSet] = field(default_factory=list)
    errors: list[tuple[int, str]] = field(default_factory=list)
    skipped: int = 0


def _strip_comment(line: str) -> str:
    """Remove a ';' comment that is not inside quotes."""
    in_quotes = False
    escaped = False
    for index, char in enumerate(line):
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
        elif char == '"':
            in_quotes = not in_quotes
        elif char == ";" and not in_quotes:
            return line[:index]
    return line


def _logical_entries(text: str) -> list[tuple[int, str]]:
    """Yield (first line number, entry text) with parenthesised continuations joined."""
    entries: list[tuple[int, str]] = []
    buffer: list[str] = []
    start = 0
    depth = 0
    for number, raw in enumerate(text.splitlines(), start=1):
        line = _strip_comment(raw).rstrip()
        if not buffer:
            if not line.strip():
                continue
            start = number
        buffer.append(line)
        depth += line.count("(") - line.count(")")
        if depth <= 0:
            entries.append((start, " ".join(buffer) if len(buffer) > 1 else buffer[0]))
            buffer, depth = [], 0
    if buffer:
        entries.append((start, " ".join(buffer)))
    return entries


def _clean_error(exc: Exception) -> str:
    message = str(exc)
    # dnspython prefixes '<string>:3: ' — we report our own line numbers
    if message.startswith("<string>:"):
        message = message.split(": ", 1)[-1]
    return message or exc.__class__.__name__


def parse_zone_file(text: str, zone_name: str) -> ParseResult:
    result = ParseResult()
    origin = dns.name.from_text(zone_name)
    zone_origin = origin
    default_ttl: int | None = None
    last_owner: str | None = None
    grouped: OrderedDict[tuple[str, str], ParsedRecordSet] = OrderedDict()

    for line_no, entry in _logical_entries(text):
        stripped = entry.strip()
        upper = stripped.upper()
        if upper.startswith("$ORIGIN"):
            parts = stripped.split()
            try:
                origin = dns.name.from_text(parts[1], origin=origin)
            except (IndexError, dns.exception.DNSException) as exc:
                result.errors.append((line_no, f"Invalid $ORIGIN: {_clean_error(exc)}"))
            continue
        if upper.startswith("$TTL"):
            parts = stripped.split()
            try:
                default_ttl = int(parts[1])
            except (IndexError, ValueError):
                result.errors.append((line_no, "Invalid $TTL directive"))
            continue
        if upper.startswith("$"):
            result.errors.append((line_no, f"Unsupported directive: {stripped.split()[0]}"))
            continue

        # A line starting with whitespace continues the previous owner name
        if entry[:1].isspace():
            if last_owner is None:
                result.errors.append((line_no, "The record has no owner name"))
                continue
            entry = f"{last_owner} {stripped}"
        else:
            owner_text, _, rest = stripped.partition(" ")
            try:
                if owner_text == "@":
                    last_owner = origin.to_text()
                else:
                    last_owner = dns.name.from_text(owner_text, origin=origin).to_text()
            except dns.exception.DNSException as exc:
                result.errors.append((line_no, f"Invalid owner name: {_clean_error(exc)}"))
                continue
            entry = f"{last_owner} {rest}"

        source = f"$ORIGIN {origin.to_text()}\n"
        source += f"$TTL {default_ttl if default_ttl is not None else DEFAULT_TTL}\n"
        source += entry + "\n"
        try:
            parsed = dns.zone.from_text(
                source, origin=zone_origin, relativize=False, check_origin=False
            )
        except (dns.exception.DNSException, ValueError, KeyError) as exc:
            result.errors.append((line_no, _clean_error(exc)))
            continue

        for owner, ttl, rdata in parsed.iterate_rdatas():
            rtype = dns.rdatatype.to_text(rdata.rdtype)
            fqdn = owner.to_text().lower()
            if not owner.is_subdomain(zone_origin):
                result.errors.append(
                    (line_no, f"{display_name(fqdn)} is not in the zone {display_name(zone_name)}")
                )
                continue
            if rtype not in SUPPORTED_TYPES:
                result.errors.append((line_no, f"Unsupported record type: {rtype}"))
                continue
            if owner == zone_origin and rtype in ("SOA", "NS"):
                result.skipped += 1  # Route53 keeps its own apex SOA and NS
                continue
            if rtype == "SOA":
                result.errors.append((line_no, "An SOA record is allowed only at the zone apex"))
                continue
            key = (fqdn, rtype)
            value = rdata.to_text(relativize=False)
            if key in grouped:
                grouped[key].values.append(value)
                grouped[key].ttl = min(grouped[key].ttl, ttl)
            else:
                grouped[key] = ParsedRecordSet(fqdn, rtype, ttl, [value], line_no)

    result.record_sets = list(grouped.values())
    return result


# ---------------------------------------------------------------- export


def to_bind(zone_name: str, records: list[RecordSet]) -> str:
    lines = [
        f"; Zone file for {display_name(zone_name)}",
        "; Exported from the Route 53 console clone",
        f"$ORIGIN {zone_name}",
        f"$TTL {DEFAULT_TTL}",
    ]
    for record in records:
        if record.alias_dns_name is not None:
            lines.append(
                f"; {record.name} {record.type} ALIAS {record.alias_dns_name} "
                "(alias records have no BIND equivalent)"
            )
            continue
        for value in record.values:
            lines.append(f"{record.name}\t{record.ttl}\tIN\t{record.type}\t{value.value}")
    return "\n".join(lines) + "\n"


def to_route53_json(records: list[RecordSet]) -> dict[str, list[dict[str, object]]]:
    """Mirrors the ResourceRecordSets list returned by Route53's ListResourceRecordSets."""
    items: list[dict[str, object]] = []
    for record in records:
        item: dict[str, object] = {"Name": record.name, "Type": record.type}
        if record.set_identifier is not None:
            item["SetIdentifier"] = record.set_identifier
        if record.weight is not None:
            item["Weight"] = record.weight
        if record.region is not None:
            item["Region"] = record.region
        if record.failover is not None:
            item["Failover"] = record.failover
        if record.routing_policy == "MULTIVALUE":
            item["MultiValueAnswer"] = True
        if record.alias_dns_name is not None:
            item["AliasTarget"] = {
                "HostedZoneId": record.alias_zone_id,
                "DNSName": record.alias_dns_name,
                "EvaluateTargetHealth": bool(record.alias_evaluate_health),
            }
        else:
            item["TTL"] = record.ttl
            item["ResourceRecords"] = [{"Value": v.value} for v in record.values]
        if record.health_check_id is not None:
            item["HealthCheckId"] = record.health_check_id
        items.append(item)
    return {"ResourceRecordSets": items}
