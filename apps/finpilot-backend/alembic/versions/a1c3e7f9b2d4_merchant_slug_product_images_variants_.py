"""merchant slug, product images/variants, order quantity

Revision ID: a1c3e7f9b2d4
Revises: 11d25a45abd7
Create Date: 2026-08-30 21:00:00.000000

"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c3e7f9b2d4'
down_revision: Union[str, None] = '11d25a45abd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "merchant"


def upgrade() -> None:
    # --- merchants.slug ---
    op.add_column('merchants', sa.Column('slug', sa.String(), nullable=True))

    # Backfill any pre-existing rows (a fresh `seed_data.py --reset` run
    # supplies slug directly, but the column must tolerate rows created
    # before this migration).
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, name FROM merchants")).fetchall()
    seen: set[str] = set()
    for row in rows:
        base = _slugify(row.name)
        slug = base
        n = 2
        while slug in seen:
            slug = f"{base}-{n}"
            n += 1
        seen.add(slug)
        conn.execute(sa.text("UPDATE merchants SET slug = :slug WHERE id = :id"), {"slug": slug, "id": row.id})

    op.alter_column('merchants', 'slug', nullable=False)
    op.create_unique_constraint('uq_merchants_slug', 'merchants', ['slug'])

    # --- products: images + variants ---
    op.add_column('products', sa.Column('image_data', sa.LargeBinary(), nullable=True))
    op.add_column('products', sa.Column('image_mime_type', sa.String(), nullable=True))
    op.add_column('products', sa.Column('variant_group', sa.String(), nullable=True))
    op.add_column('products', sa.Column('variant_label', sa.String(), nullable=True))
    op.create_index('ix_products_variant_group', 'products', ['variant_group'])

    # --- orders.quantity ---
    op.add_column('orders', sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    op.drop_column('orders', 'quantity')

    op.drop_index('ix_products_variant_group', table_name='products')
    op.drop_column('products', 'variant_label')
    op.drop_column('products', 'variant_group')
    op.drop_column('products', 'image_mime_type')
    op.drop_column('products', 'image_data')

    op.drop_constraint('uq_merchants_slug', 'merchants', type_='unique')
    op.drop_column('merchants', 'slug')
