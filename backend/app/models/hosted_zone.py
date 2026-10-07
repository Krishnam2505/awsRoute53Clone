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
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models._common import utcnow

if TYPE_CHECKING:
    from app.models.record_set import RecordSet
    from app.models.tag import HostedZoneTag
    from app.models.user import User
    from app.models.vpc import HostedZoneVPC


class HostedZone(Base):
    __tablename__ = "hosted_zones"
    __table_args__ = (
        CheckConstraint("is_private IN (0, 1)", name="ck_hosted_zones_is_private"),
        Index("ix_zones_owner_name", "owner_id", "name"),
    )

    # Route53-style ID: 'Z' + 20 uppercase alphanumerics
    id: Mapped[str] = mapped_column(String, primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Lower-case FQDN with trailing dot: 'example.com.'
    # Deliberately not unique: Route53 allows several zones with the same name.
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Route53 calls this the comment
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    is_private: Mapped[bool] = mapped_column(
        Boolean(create_constraint=False), nullable=False, default=False, server_default="0"
    )
    caller_reference: Mapped[str] = mapped_column(String, nullable=False, unique=True)
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

    owner: Mapped["User"] = relationship(back_populates="hosted_zones")
    vpcs: Mapped[list["HostedZoneVPC"]] = relationship(
        back_populates="zone",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="HostedZoneVPC.region, HostedZoneVPC.vpc_id",
    )
    tags: Mapped[list["HostedZoneTag"]] = relationship(
        back_populates="zone",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="HostedZoneTag.key",
    )
    record_sets: Mapped[list["RecordSet"]] = relationship(
        back_populates="zone", cascade="all, delete-orphan", passive_deletes=True
    )
