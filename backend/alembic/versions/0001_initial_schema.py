"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-07
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("account_id", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_table(
        "hosted_zones",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("is_private", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("caller_reference", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("is_private IN (0, 1)", name="ck_hosted_zones_is_private"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("caller_reference"),
    )
    with op.batch_alter_table("hosted_zones", schema=None) as batch_op:
        batch_op.create_index("ix_zones_owner_name", ["owner_id", "name"], unique=False)

    op.create_table(
        "sessions",
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_sessions_user_id"), ["user_id"], unique=False)

    op.create_table(
        "changes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("zone_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="INSYNC", nullable=False),
        sa.Column("comment", sa.String(), nullable=True),
        sa.Column("actions_json", sa.Text(), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["zone_id"], ["hosted_zones.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "hosted_zone_tags",
        sa.Column("zone_id", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), server_default="", nullable=False),
        sa.ForeignKeyConstraint(["zone_id"], ["hosted_zones.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("zone_id", "key"),
    )
    op.create_table(
        "hosted_zone_vpcs",
        sa.Column("zone_id", sa.String(), nullable=False),
        sa.Column("region", sa.String(), nullable=False),
        sa.Column("vpc_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["zone_id"], ["hosted_zones.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("zone_id", "region", "vpc_id"),
    )
    op.create_table(
        "record_sets",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("zone_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("ttl", sa.Integer(), nullable=True),
        sa.Column("routing_policy", sa.String(), server_default="SIMPLE", nullable=False),
        sa.Column("set_identifier", sa.String(), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("region", sa.String(), nullable=True),
        sa.Column("failover", sa.String(), nullable=True),
        sa.Column("health_check_id", sa.String(), nullable=True),
        sa.Column("alias_dns_name", sa.String(), nullable=True),
        sa.Column("alias_zone_id", sa.String(), nullable=True),
        sa.Column("alias_evaluate_health", sa.Boolean(), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "failover IS NULL OR failover IN ('PRIMARY','SECONDARY')",
            name="ck_record_sets_failover",
        ),
        sa.CheckConstraint(
            "type IN ('A','AAAA','CNAME','TXT','MX','NS','PTR','SRV','CAA','SOA')",
            name="ck_record_sets_type",
        ),
        sa.CheckConstraint(
            "ttl IS NULL OR ttl BETWEEN 0 AND 2147483647", name="ck_record_sets_ttl"
        ),
        sa.CheckConstraint(
            "weight IS NULL OR weight BETWEEN 0 AND 255", name="ck_record_sets_weight"
        ),
        sa.ForeignKeyConstraint(["zone_id"], ["hosted_zones.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("record_sets", schema=None) as batch_op:
        batch_op.create_index("ix_rrset_zone_type", ["zone_id", "type"], unique=False)
    # Route53's identity rule: one record set per (name, type, set identifier) in a zone.
    # Expression indexes can't be autogenerated on SQLite, so it is written by hand.
    op.execute(
        "CREATE UNIQUE INDEX ux_rrset_identity "
        "ON record_sets (zone_id, name, type, IFNULL(set_identifier, ''))"
    )

    op.create_table(
        "record_values",
        sa.Column("record_set_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["record_set_id"], ["record_sets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("record_set_id", "position"),
    )


def downgrade() -> None:
    op.drop_table("record_values")
    op.execute("DROP INDEX IF EXISTS ux_rrset_identity")
    with op.batch_alter_table("record_sets", schema=None) as batch_op:
        batch_op.drop_index("ix_rrset_zone_type")

    op.drop_table("record_sets")
    op.drop_table("hosted_zone_vpcs")
    op.drop_table("hosted_zone_tags")
    op.drop_table("changes")
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_sessions_user_id"))

    op.drop_table("sessions")
    with op.batch_alter_table("hosted_zones", schema=None) as batch_op:
        batch_op.drop_index("ix_zones_owner_name")

    op.drop_table("hosted_zones")
    op.drop_table("users")
