"""Domain-name parsing and normalisation.

Names are stored lower-case with a trailing dot ('www.example.com.') and the
API accepts any of 'www', 'www.example.com' or 'www.example.com.'.
"""

import re

MAX_NAME_LENGTH = 255
MAX_LABEL_LENGTH = 63

_ZONE_LABEL = re.compile(r"^[a-z0-9-]+$")
_RECORD_LABEL = re.compile(r"^[a-z0-9_-]+$")
_HOST_LABEL = re.compile(r"^[a-z0-9_-]+$")


class InvalidNameError(ValueError):
    """Raised with a console-style message when a name is not valid."""


def _split_labels(name: str) -> list[str]:
    stripped = name[:-1] if name.endswith(".") else name
    return stripped.split(".") if stripped else []


def _check_length(fqdn: str) -> None:
    if len(fqdn) > MAX_NAME_LENGTH:
        raise InvalidNameError(
            f"The domain name can have a maximum of {MAX_NAME_LENGTH} characters."
        )


def normalize_zone_name(raw: str) -> str:
    """Validate a hosted zone domain name and return it as 'example.com.'."""
    name = raw.strip().lower()
    if not name or name == ".":
        raise InvalidNameError("Enter a domain name.")
    labels = _split_labels(name)
    if any(label == "" for label in labels):
        raise InvalidNameError("The domain name can't contain empty labels (two dots in a row).")
    for label in labels:
        if len(label) > MAX_LABEL_LENGTH:
            raise InvalidNameError(
                f"Each label in the domain name can have a maximum of {MAX_LABEL_LENGTH} "
                "characters."
            )
        if not _ZONE_LABEL.match(label):
            raise InvalidNameError(
                "The domain name can contain only the characters a-z, 0-9, - (hyphen) and "
                ". (period)."
            )
        if label.startswith("-") or label.endswith("-"):
            raise InvalidNameError("A label in the domain name can't start or end with a hyphen.")
    if len(labels) < 2:
        raise InvalidNameError(
            "Enter a domain name with at least two labels, for example example.com. "
            "A top-level domain on its own is not allowed."
        )
    fqdn = ".".join(labels) + "."
    _check_length(fqdn)
    return fqdn


def normalize_record_name(raw: str, zone_name: str) -> str:
    """Turn user input into the record's FQDN inside zone_name.

    '', '@'                       -> zone apex
    'www'                         -> 'www.example.com.'
    'www.example.com'             -> 'www.example.com.'
    'www.example.com.'            -> 'www.example.com.'
    """
    name = raw.strip().lower()
    zone_bare = zone_name[:-1]

    if name in ("", "@"):
        return zone_name
    if name.endswith("."):
        fqdn = name
    elif name == zone_bare or name.endswith("." + zone_bare):
        fqdn = name + "."
    else:
        fqdn = f"{name}.{zone_name}"

    if fqdn != zone_name and not fqdn.endswith("." + zone_name):
        raise InvalidNameError(
            f"The record name must be the zone name ({zone_bare}) or a subdomain of it."
        )

    labels = _split_labels(fqdn)
    if any(label == "" for label in labels):
        raise InvalidNameError("The record name can't contain empty labels (two dots in a row).")
    for index, label in enumerate(labels):
        if label == "*":
            if index != 0:
                raise InvalidNameError("A * wildcard is allowed only as the leftmost label.")
            continue
        if len(label) > MAX_LABEL_LENGTH:
            raise InvalidNameError(
                f"Each label in the record name can have a maximum of {MAX_LABEL_LENGTH} "
                "characters."
            )
        if not _RECORD_LABEL.match(label):
            raise InvalidNameError(
                "The record name can contain only a-z, 0-9, - (hyphen), _ (underscore) and "
                ". (period), plus a leading * wildcard."
            )
    _check_length(fqdn)
    return fqdn


def is_valid_hostname(value: str) -> bool:
    """A domain name used as a record value (CNAME, MX, NS, PTR, SRV targets)."""
    host = value.strip().lower()
    if not host or host == ".":
        return False
    if len(host.rstrip(".")) > MAX_NAME_LENGTH - 2:
        return False
    labels = _split_labels(host)
    return all(
        0 < len(label) <= MAX_LABEL_LENGTH and _HOST_LABEL.match(label) is not None
        for label in labels
    )


def display_name(fqdn: str) -> str:
    """'www.example.com.' -> 'www.example.com', the way the console shows names."""
    return fqdn[:-1] if fqdn.endswith(".") else fqdn
