"""remove_approver_and_admin_role

Revision ID: c1d2e3f4a5b6
Revises: b8c9d0e1f2a3
Create Date: 2026-10-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. Migrate any existing approver users to admin
    if 'users' in existing_tables:
        op.execute("UPDATE users SET role = 'admin' WHERE role = 'approver'")
        user_cols = [c['name'] for c in inspector.get_columns('users')]
        if 'admin_role' in user_cols:
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.drop_column('admin_role')


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'users' in existing_tables:
        user_cols = [c['name'] for c in inspector.get_columns('users')]
        if 'admin_role' not in user_cols:
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.add_column(sa.Column('admin_role', sa.String(), nullable=True, server_default='super_admin'))
