from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.record_set import RecordSet


class RecordValue(Base):
    """One value of a record set: a record with three IPs is three rows."""

    __tablename__ = "record_values"

    record_set_id: Mapped[str] = mapped_column(
        String, ForeignKey("record_sets.id", ondelete="CASCADE"), primary_key=True
    )
    # Keeps the order the user typed
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)

    record_set: Mapped["RecordSet"] = relationship(back_populates="values")
