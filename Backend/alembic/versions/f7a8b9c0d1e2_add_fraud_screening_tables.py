"""add_fraud_screening_tables

Revision ID: f7a8b9c0d1e2
Revises: 129062df3495
Create Date: 2026-10-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, Sequence[str], None] = '129062df3495'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. fraud_runs table
    op.create_table(
        'fraud_runs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('overall_status', sa.String(), nullable=False),
        sa.Column('risk_index', sa.Float(), nullable=True),
        sa.Column('model_version', sa.String(), server_default='v2.1', nullable=False),
        sa.Column('trigger', sa.String(), server_default='submission', nullable=False),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.project_id']),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('fraud_runs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_fraud_runs_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_fraud_runs_project_id'), ['project_id'], unique=False)

    # 2. fraud_checks table
    op.create_table(
        'fraud_checks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('validator', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('evidence_refs', sa.Text(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['fraud_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('fraud_checks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_fraud_checks_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_fraud_checks_run_id'), ['run_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_fraud_checks_validator'), ['validator'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('fraud_checks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_fraud_checks_validator'))
        batch_op.drop_index(batch_op.f('ix_fraud_checks_run_id'))
        batch_op.drop_index(batch_op.f('ix_fraud_checks_id'))
    op.drop_table('fraud_checks')

    with op.batch_alter_table('fraud_runs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_fraud_runs_project_id'))
        batch_op.drop_index(batch_op.f('ix_fraud_runs_id'))
    op.drop_table('fraud_runs')
