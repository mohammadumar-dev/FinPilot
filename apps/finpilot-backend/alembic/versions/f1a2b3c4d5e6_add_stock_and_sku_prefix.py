"""add products.stock_quantity and merchants.sku_prefix, backfill both

Revision ID: f1a2b3c4d5e6
Revises: e5f8b2c9a1d7
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e5f8b2c9a1d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The per-merchant SKU prefix already implicit in every seeded SKU today
# (e.g. "SF-SHOE-MEN-RUN-PRO"). Backfilled by merchant name so existing
# rows get a real value instead of the '' server_default.
_MERCHANT_SKU_PREFIXES = {
    "StepForward Footwear": "SF",
    "Threadline Apparel": "TL",
    "CircuitHub Computer Accessories": "CH",
    "NovaTech Mobiles & Laptops": "NT",
    "PageTurner Books": "PT",
    "GreenBasket Grocery": "GB",
    "HomeNest Furnishings": "HN",
    "GlowUp Beauty": "GU",
    "SprintZone Sports": "SZ",
    "TinyTots Toys": "TT",
    "PawPals Pet Supplies": "PP",
    "KitchenCraft Essentials": "KC",
    "AutoGear Motors": "AG",
    "AromaHome Fragrances": "AH",
    "UrbanStyle Accessories": "US",
}


def upgrade() -> None:
    op.add_column("products", sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("merchants", sa.Column("sku_prefix", sa.String(), nullable=False, server_default=""))

    # Existing rows: give already-seeded products a sane non-zero stock
    # instead of instantly looking fully out of stock, and backfill each
    # known merchant's real prefix by name.
    op.execute("UPDATE products SET stock_quantity = 25")

    conn = op.get_bind()
    merchants_table = sa.table("merchants", sa.column("id"), sa.column("name"), sa.column("sku_prefix"))
    for name, prefix in _MERCHANT_SKU_PREFIXES.items():
        conn.execute(merchants_table.update().where(merchants_table.c.name == name).values(sku_prefix=prefix))


def downgrade() -> None:
    op.drop_column("merchants", "sku_prefix")
    op.drop_column("products", "stock_quantity")
