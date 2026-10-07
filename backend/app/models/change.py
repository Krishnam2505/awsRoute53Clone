from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._common import utcnow


class Change(Base):
    """Mimics Route53 change IDs and doubles as an audit log."""

    __tablename__ = "changes"

    # 'C' + random, returned after every write
    id: Mapped[str] = mapped_column(String, primary_key=True)
    zone_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("hosted_zones.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String, nullable=False, default="INSYNC", server_default="INSYNC"
    )
    comment: Mapped[str | None] = mapped_column(String, nullable=True)
    # The CREATE / UPSERT / DELETE list that was applied
    actions_json: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utcnow, server_default=func.current_timestamp()
    )
