"""Picks the four Route53-style name servers a new hosted zone is given.

Real Route53 delegation sets use one server on each of .com, .net, .org and
.co.uk, numbered 0-511, 512-1023, 1024-1535 and 1536-2047 respectively, with
the awsdns-NN number derived from the server number. We reproduce that shape.
"""

import secrets

_TLDS = (("com", 0), ("net", 512), ("org", 1024), ("co.uk", 1536))


def pick_name_servers() -> list[str]:
    servers: list[str] = []
    for tld, base in _TLDS:
        number = base + secrets.randbelow(512)
        awsdns = (number - base) // 8
        servers.append(f"ns-{number}.awsdns-{awsdns:02d}.{tld}.")
    # Route53 returns them in no particular TLD order
    order = sorted(range(4), key=lambda _: secrets.randbelow(1000))
    return [servers[i] for i in order]


def soa_value(primary_name_server: str, zone_name: str) -> str:
    """primary NS, admin email, serial, refresh, retry, expire, minimum TTL."""
    return f"{primary_name_server} hostmaster.{zone_name} 1 7200 900 1209600 86400"


DEFAULT_NS_TTL = 172800
DEFAULT_SOA_TTL = 900
