from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.hosted_zone import HostedZone


class HostedZoneVPC(Base):
    """A VPC associated with a private hosted zone (mocked, nothing real is called)."""

    __tablename__ = "hosted_zone_vpcs"

    zone_id: Mapped[str] = mapped_column(
        String, ForeignKey("hosted_zones.id", ondelete="CASCADE"), primary_key=True
    )
    region: Mapped[str] = mapped_column(String, primary_key=True)
    vpc_id: Mapped[str] = mapped_column(String, primary_key=True)

    zone: Mapped["HostedZone"] = relationship(back_populates="vpcs")
