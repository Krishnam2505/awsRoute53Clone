"""Demo data, so a reviewer lands on a populated console on first sign-in.

Runs only when the database has no users: `python -m app.seed`.
Everything is created through the services, so seed data obeys the same rules
as data entered in the UI.
"""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User
from app.schemas.change import ChangeAction, ChangeBatchRequest
from app.schemas.hosted_zone import HostedZoneCreate, Tag, VPCIn
from app.schemas.record_set import AliasTarget, RecordSetCreate
from app.services import zone_service
from app.services.change_batch import apply_change_batch

DEMO_USERS = (
    ("demo", "demo1234", "123456789012"),
    ("alice", "alice1234", "210987654321"),
)

CLOUDFRONT_ZONE_ID = "Z2FDTNDATAQYW2"
S3_US_EAST_1_ZONE_ID = "Z3AQBSTGFYJSTF"


def _rr(name: str, rtype: str, *values: str, ttl: int = 300, **extra: Any) -> RecordSetCreate:
    return RecordSetCreate(name=name, type=rtype, ttl=ttl, values=list(values), **extra)


def _example_com_records() -> list[RecordSetCreate]:
    records = [
        _rr("", "A", "192.0.2.10", "192.0.2.11"),
        _rr("", "AAAA", "2001:db8::10"),
        _rr("", "MX", "10 mail1.example.com", "20 mail2.example.com", ttl=3600),
        _rr(
            "",
            "TXT",
            '"v=spf1 include:_spf.example.com ~all"',
            '"google-site-verification=rXOxyZounnZasA8Z7oaD3c14JdjS9aKSWvsR1EbUSIQ"',
        ),
        _rr(
            "",
            "CAA",
            '0 issue "amazon.com"',
            '0 issuewild "amazon.com"',
            '0 iodef "mailto:security@example.com"',
            ttl=3600,
        ),
        _rr("www", "CNAME", "example.com"),
        _rr("api", "A", "192.0.2.20", "192.0.2.21", ttl=60),
        _rr("api", "AAAA", "2001:db8::20", ttl=60),
        _rr("mail1", "A", "192.0.2.25"),
        _rr("mail2", "A", "192.0.2.26"),
        _rr("_dmarc", "TXT", '"v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"'),
        _rr(
            "selector1._domainkey",
            "TXT",
            (
                '"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1TaNgLlSyQMN'
                "WVLNLvyY/neDgaL2oqQE8T5illKqCgDtFHc8eHVAU+nlcaGmrKmDMw9dbgiGk1ocgZ56NR"
                "4ycfUHwQhvQPMUZw0cveel/8EAGoi/UyPmqfcPibytH81NFtTMAxUeM4Op8A6iHkvAMj5q"
                'Lf4YRNsTkKAKW3OkwPQIDAQAB"'
            ),
        ),
        _rr("_sip._tcp", "SRV", "10 60 5060 sip1.example.com", "20 40 5060 sip2.example.com"),
        _rr("_xmpp-server._tcp", "SRV", "5 0 5269 xmpp.example.com"),
        _rr("_ldap._tcp", "SRV", "0 100 389 ldap.example.com"),
        _rr("blog", "CNAME", "example.ghost.io"),
        _rr("shop", "CNAME", "shops.myshopify.com"),
        _rr("docs", "CNAME", "example.readthedocs.io"),
        _rr("status", "CNAME", "stats.uptimerobot.com"),
        _rr("cdn", "CNAME", "d111111abcdef8.cloudfront.net"),
        _rr("dev", "NS", "ns-1.dev-dns.example.net", "ns-2.dev-dns.example.net", ttl=172800),
        _rr("host-10", "PTR", "www.example.com"),
        _rr("*.preview", "A", "192.0.2.50"),
        _rr("vpn", "A", "198.51.100.7"),
        _rr("git", "A", "198.51.100.8"),
        _rr("ci", "A", "198.51.100.9"),
        _rr("grafana", "A", "198.51.100.10"),
        _rr("sip1", "A", "198.51.100.20"),
        _rr("sip2", "A", "198.51.100.21"),
        _rr("xmpp", "A", "198.51.100.22"),
        _rr("ldap", "A", "198.51.100.23"),
        # Weighted, failover, latency and multivalue examples
        _rr(
            "lb",
            "A",
            "203.0.113.10",
            routing_policy="WEIGHTED",
            set_identifier="blue",
            weight=70,
            ttl=60,
        ),
        _rr(
            "lb",
            "A",
            "203.0.113.20",
            routing_policy="WEIGHTED",
            set_identifier="green",
            weight=30,
            ttl=60,
        ),
        _rr(
            "portal",
            "A",
            "203.0.113.30",
            routing_policy="FAILOVER",
            set_identifier="primary",
            failover="PRIMARY",
            health_check_id="abcdef11-2222-3333-4444-555555fedcba",
            ttl=60,
        ),
        _rr(
            "portal",
            "A",
            "203.0.113.31",
            routing_policy="FAILOVER",
            set_identifier="secondary",
            failover="SECONDARY",
            ttl=60,
        ),
        _rr(
            "edge",
            "A",
            "203.0.113.40",
            routing_policy="LATENCY",
            set_identifier="us-east",
            region="us-east-1",
        ),
        _rr(
            "edge",
            "A",
            "203.0.113.41",
            routing_policy="LATENCY",
            set_identifier="eu-west",
            region="eu-west-1",
        ),
        _rr("mv", "A", "203.0.113.50", routing_policy="MULTIVALUE", set_identifier="mv-1"),
        _rr("mv", "A", "203.0.113.51", routing_policy="MULTIVALUE", set_identifier="mv-2"),
        # Alias records
        RecordSetCreate(
            name="static",
            type="A",
            ttl=None,
            alias=AliasTarget(
                dns_name="d111111abcdef8.cloudfront.net",
                hosted_zone_id=CLOUDFRONT_ZONE_ID,
                evaluate_target_health=False,
            ),
        ),
        RecordSetCreate(
            name="assets",
            type="A",
            ttl=None,
            alias=AliasTarget(
                dns_name="s3-website-us-east-1.amazonaws.com",
                hosted_zone_id=S3_US_EAST_1_ZONE_ID,
                evaluate_target_health=False,
            ),
        ),
    ]
    # Enough application hosts that the records table paginates in the demo
    records += [_rr(f"app-{n:02d}", "A", f"10.0.{n}.10") for n in range(1, 21)]
    return records


def _acme_records() -> list[RecordSetCreate]:
    return [
        _rr("", "A", "192.0.2.100"),
        _rr("www", "CNAME", "acme-corp.io"),
        _rr(
            "",
            "MX",
            "1 aspmx.l.google.com",
            "5 alt1.aspmx.l.google.com",
            "5 alt2.aspmx.l.google.com",
            ttl=3600,
        ),
        _rr("", "TXT", '"v=spf1 include:_spf.google.com ~all"'),
        _rr("careers", "CNAME", "acme.greenhouse.io"),
    ]


def _corp_internal_records() -> list[RecordSetCreate]:
    return [
        _rr("db", "A", "10.10.0.15"),
        _rr("cache", "A", "10.10.0.30"),
        _rr("queue", "A", "10.10.0.45"),
        _rr("15.0.10.10", "PTR", "db.corp.internal"),
    ]


def _staging_records() -> list[RecordSetCreate]:
    return [
        _rr("", "A", "192.0.2.200"),
        _rr("api", "CNAME", "staging-api.example.net"),
    ]


def _create(
    db: Session, user: User, zone: HostedZoneCreate, records: list[RecordSetCreate]
) -> None:
    created, _ = zone_service.create_zone(db, user, zone)
    if records:
        batch = ChangeBatchRequest(
            comment="Seed data",
            changes=[ChangeAction(action="CREATE", record_set=r) for r in records],
        )
        apply_change_batch(db, created, batch)


def seed(db: Session) -> bool:
    """Create the demo users and zones. Returns False if the database was not empty."""
    if (db.scalar(select(func.count(User.id))) or 0) > 0:
        return False

    users = {}
    for username, password, account_id in DEMO_USERS:
        user = User(username=username, password_hash=hash_password(password), account_id=account_id)
        db.add(user)
        users[username] = user
    db.commit()

    demo = users["demo"]
    _create(
        db,
        demo,
        HostedZoneCreate(
            name="example.com",
            description="Marketing site",
            type="public",
            tags=[Tag(key="env", value="prod"), Tag(key="team", value="web")],
        ),
        _example_com_records(),
    )
    _create(
        db,
        demo,
        HostedZoneCreate(
            name="acme-corp.io",
            description="Corporate website and Google Workspace mail",
            type="public",
            tags=[Tag(key="env", value="prod"), Tag(key="cost-center", value="1234")],
        ),
        _acme_records(),
    )
    _create(
        db,
        demo,
        HostedZoneCreate(
            name="corp.internal",
            description="Internal service discovery",
            type="private",
            vpcs=[
                VPCIn(region="us-east-1", vpc_id="vpc-0a1b2c3d4e5f67890"),
                VPCIn(region="eu-west-1", vpc_id="vpc-0123456789abcdef0"),
            ],
            tags=[Tag(key="env", value="prod")],
        ),
        _corp_internal_records(),
    )
    _create(
        db,
        demo,
        HostedZoneCreate(name="staging.example.com", description="", type="public"),
        _staging_records(),
    )
    _create(db, demo, HostedZoneCreate(name="empty-zone.dev", type="public"), [])

    _create(
        db,
        users["alice"],
        HostedZoneCreate(name="alice-photos.net", description="Alice's portfolio"),
        [_rr("", "A", "192.0.2.77")],
    )
    return True


def main() -> None:
    with SessionLocal() as db:
        if seed(db):
            print("Seeded demo data. Sign in as demo / demo1234 (account 123456789012).")
        else:
            print("Database already has data; seed skipped.")


if __name__ == "__main__":
    main()
