"""campaign stop/schedule: add 'ended' status, start_date/end_date/ended_at

Revision ID: b3c5d7e9f1a3
Revises: a2b4c6d8e0f2
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c5d7e9f1a3'
down_revision: Union[str, None] = 'a2b4c6d8e0f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('campaigns', sa.Column('start_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('campaigns', sa.Column('end_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('campaigns', sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True))

    op.drop_constraint('ck_campaigns_status', 'campaigns', type_='check')
    op.create_check_constraint(
        'ck_campaigns_status',
        'campaigns',
        "status IN ('proposed','approved','applied','rejected','ended')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_campaigns_status', 'campaigns', type_='check')
    op.create_check_constraint(
        'ck_campaigns_status',
        'campaigns',
        "status IN ('proposed','approved','applied','rejected')",
    )
    op.drop_column('campaigns', 'ended_at')
    op.drop_column('campaigns', 'end_date')
    op.drop_column('campaigns', 'start_date')
