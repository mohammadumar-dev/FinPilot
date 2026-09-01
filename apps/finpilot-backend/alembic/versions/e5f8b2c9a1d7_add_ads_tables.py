"""add ads tables (ad_wallets, ad_wallet_topups, ad_campaigns)

Revision ID: e5f8b2c9a1d7
Revises: d3e6a9c1f4b2
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5f8b2c9a1d7'
down_revision: Union[str, None] = 'd3e6a9c1f4b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ad_wallets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('merchant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('balance_paise', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['merchant_id'], ['merchants.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('merchant_id', name='uq_ad_wallets_merchant_id'),
        sa.CheckConstraint('balance_paise >= 0', name='ck_ad_wallets_balance_non_negative'),
    )

    op.create_table(
        'ad_wallet_topups',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('merchant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('razorpay_order_id', sa.String(), nullable=True),
        sa.Column('payment_link', sa.String(), nullable=True),
        sa.Column('amount_paise', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='created'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['merchant_id'], ['merchants.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('created','pending','paid','failed')", name='ck_ad_wallet_topups_status'),
    )
    op.create_index('ix_ad_wallet_topups_merchant_id', 'ad_wallet_topups', ['merchant_id'])

    op.create_table(
        'ad_campaigns',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('merchant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('cost_per_click_paise', sa.Integer(), nullable=False),
        sa.Column('daily_budget_paise', sa.Integer(), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['merchant_id'], ['merchants.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('active','paused','ended')", name='ck_ad_campaigns_status'),
    )
    op.create_index('ix_ad_campaigns_merchant_id', 'ad_campaigns', ['merchant_id'])
    op.create_index('ix_ad_campaigns_product_id', 'ad_campaigns', ['product_id'])


def downgrade() -> None:
    op.drop_index('ix_ad_campaigns_product_id', table_name='ad_campaigns')
    op.drop_index('ix_ad_campaigns_merchant_id', table_name='ad_campaigns')
    op.drop_table('ad_campaigns')
    op.drop_index('ix_ad_wallet_topups_merchant_id', table_name='ad_wallet_topups')
    op.drop_table('ad_wallet_topups')
    op.drop_table('ad_wallets')
