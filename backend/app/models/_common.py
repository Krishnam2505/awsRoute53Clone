from datetime import UTC, datetime


def utcnow() -> datetime:
    """Naive UTC timestamp, matching what SQLite's CURRENT_TIMESTAMP stores."""
    return datetime.now(UTC).replace(tzinfo=None)
