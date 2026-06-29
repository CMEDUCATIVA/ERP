"""Catalog resource type registry.

Revision ID: v3188_catalog_resource_types
Revises: v3187_cmproyectosbim_project_mapping
Create Date: 2026-06-27
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3188_catalog_resource_types"
down_revision = "v3187_cmproyectosbim_project_mapping"
branch_labels = None
depends_on = None

_TABLE = "oe_catalog_resource_type"


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if _has_table(_TABLE):
        return
    op.create_table(
        _TABLE,
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("value", sa.String(length=20), nullable=False),
        sa.Column("code", sa.String(length=2), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("calculation_group", sa.String(length=30), nullable=False, server_default="generic"),
        sa.Column("badge", sa.String(length=8), nullable=False, server_default="OT"),
        sa.Column("bg", sa.String(length=160), nullable=False, server_default="bg-gray-100 text-gray-600"),
        sa.Column("i18n_key", sa.String(length=100), nullable=True),
        sa.Column("fallback", sa.String(length=100), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("value", name="uq_catalog_resource_type_value"),
        sa.UniqueConstraint("code", name="uq_catalog_resource_type_code"),
    )
    op.create_index(op.f("ix_oe_catalog_resource_type_value"), _TABLE, ["value"])
    op.create_index(op.f("ix_oe_catalog_resource_type_code"), _TABLE, ["code"])
    op.create_index(op.f("ix_oe_catalog_resource_type_is_active"), _TABLE, ["is_active"])


def downgrade() -> None:
    if _has_table(_TABLE):
        op.drop_table(_TABLE)
