"""add products.cost_price_paise

Revision ID: a2b4c6d8e0f2
Revises: f1a2b3c4d5e6
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b4c6d8e0f2'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('cost_price_paise', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'cost_price_paise')
