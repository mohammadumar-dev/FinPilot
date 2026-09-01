"""add campaigns table

Revision ID: d3e6a9c1f4b2
Revises: c2d5f8a1e3b7
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd3e6a9c1f4b2'
down_revision: Union[str, None] = 'c2d5f8a1e3b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'campaigns',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('merchant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='proposed'),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('proposal', postgresql.JSONB(), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approved_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['merchant_id'], ['merchants.id']),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('proposed','approved','applied','rejected')", name='ck_campaigns_status'),
        sa.CheckConstraint("kind IN ('discount','bundle')", name='ck_campaigns_kind'),
    )
    op.create_index('ix_campaigns_merchant_id', 'campaigns', ['merchant_id'])


def downgrade() -> None:
    op.drop_index('ix_campaigns_merchant_id', table_name='campaigns')
    op.drop_table('campaigns')
