from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models._common import utcnow

if TYPE_CHECKING:
    from app.models.hosted_zone import HostedZone
    from app.models.record_value import RecordValue

RECORD_TYPES = ("A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA")
_TYPE_LIST = ",".join(f"'{t}'" for t in RECORD_TYPES)


class RecordSet(Base):
    __tablename__ = "record_sets"
    __table_args__ = (
        CheckConstraint(f"type IN ({_TYPE_LIST})", name="ck_record_sets_type"),
        CheckConstraint("ttl IS NULL OR ttl BETWEEN 0 AND 2147483647", name="ck_record_sets_ttl"),
        CheckConstraint("weight IS NULL OR weight BETWEEN 0 AND 255", name="ck_record_sets_weight"),
        CheckConstraint(
            "failover IS NULL OR failover IN ('PRIMARY','SECONDARY')",
            name="ck_record_sets_failover",
        ),
        # Route53's identity rule: one record set per (name, type, set identifier) in a zone
        Index(
            "ux_rrset_identity",
            "zone_id",
            "name",
            "type",
            text("IFNULL(set_identifier, '')"),
            unique=True,
        ),
        Index("ix_rrset_zone_type", "zone_id", "type"),
    )

    # Short random ID used in URLs
    id: Mapped[str] = mapped_column(String, primary_key=True)
    zone_id: Mapped[str] = mapped_column(
        String, ForeignKey("hosted_zones.id", ondelete="CASCADE"), nullable=False
    )
    # FQDN with trailing dot: 'www.example.com.'
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    # NULL for alias records
    ttl: Mapped[int | None] = mapped_column(Integer, nullable=True)
    routing_policy: Mapped[str] = mapped_column(
        String, nullable=False, default="SIMPLE", server_default="SIMPLE"
    )
    # Required for every non-simple policy
    set_identifier: Mapped[str | None] = mapped_column(String, nullable=True)
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Latency policy
    region: Mapped[str | None] = mapped_column(String, nullable=True)
    failover: Mapped[str | None] = mapped_column(String, nullable=True)
    health_check_id: Mapped[str | None] = mapped_column(String, nullable=True)
    alias_dns_name: Mapped[str | None] = mapped_column(String, nullable=True)
    alias_zone_id: Mapped[str | None] = mapped_column(String, nullable=True)
    alias_evaluate_health: Mapped[bool | None] = mapped_column(
        Boolean(create_constraint=False), nullable=True
    )
    # The auto-created apex SOA and NS: editable, never deletable
    is_default: Mapped[bool] = mapped_column(
        Boolean(create_constraint=False), nullable=False, default=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utcnow, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
        server_default=func.current_timestamp(),
    )

    zone: Mapped["HostedZone"] = relationship(back_populates="record_sets")
    values: Mapped[list["RecordValue"]] = relationship(
        back_populates="record_set",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="RecordValue.position",
    )

    @property
    def is_alias(self) -> bool:
        return self.alias_dns_name is not None
