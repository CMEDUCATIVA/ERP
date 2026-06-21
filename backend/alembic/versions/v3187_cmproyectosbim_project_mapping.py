"""CMPROYECTOSBIM project mappings and SSO replay ledger.

Revision ID: v3187_cmproyectosbim_project_mapping
Revises: v3186_payroll_deductions_net
Create Date: 2026-06-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3187_cmproyectosbim_project_mapping"
down_revision = "v3186_payroll_deductions_net"
branch_labels = None
depends_on = None

_MAPPING = "oe_integrations_cmproyectosbim_project"
_JTI = "oe_integrations_cmproyectosbim_jti"


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    project_columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("oe_projects_project")
    }
    if "regional_factor" not in project_columns:
        op.add_column(
            "oe_projects_project",
            sa.Column("regional_factor", sa.Float(), nullable=False, server_default="1.0"),
        )

    if not _has_table(_MAPPING):
        op.create_table(
            _MAPPING,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("provider", sa.String(length=50), nullable=False, server_default="cmproyectosbim"),
            sa.Column("external_project_id", sa.String(length=100), nullable=False),
            sa.Column("external_project_identifier", sa.String(length=255), nullable=False, server_default=""),
            sa.Column("erp_project_id", sa.String(length=36), nullable=False),
            sa.Column("last_sso_at", sa.String(length=40), nullable=True),
            sa.Column("metadata", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["erp_project_id"], ["oe_projects_project.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("provider", "external_project_id", name="uq_cmproyectosbim_external_project"),
            sa.UniqueConstraint("erp_project_id", name="uq_cmproyectosbim_erp_project"),
        )
        op.create_index(op.f("ix_oe_integrations_cmproyectosbim_project_external_project_id"), _MAPPING, ["external_project_id"])
        op.create_index(op.f("ix_oe_integrations_cmproyectosbim_project_erp_project_id"), _MAPPING, ["erp_project_id"])

    if not _has_table(_JTI):
        op.create_table(
            _JTI,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("jti", sa.String(length=100), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("jti", name="uq_cmproyectosbim_sso_jti"),
        )
        op.create_index(op.f("ix_oe_integrations_cmproyectosbim_jti_jti"), _JTI, ["jti"])
        op.create_index(op.f("ix_oe_integrations_cmproyectosbim_jti_expires_at"), _JTI, ["expires_at"])


def downgrade() -> None:
    if _has_table(_JTI):
        op.drop_table(_JTI)
    if _has_table(_MAPPING):
        op.drop_table(_MAPPING)
    project_columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("oe_projects_project")
    }
    if "regional_factor" in project_columns:
        op.drop_column("oe_projects_project", "regional_factor")
