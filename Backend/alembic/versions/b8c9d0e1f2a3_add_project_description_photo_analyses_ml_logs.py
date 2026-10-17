"""add_project_description_photo_analyses_ml_logs

Revision ID: b8c9d0e1f2a3
Revises: f7a8b9c0d1e2
Create Date: 2026-10-17 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, Sequence[str], None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. Add description and objectives to projects table if missing
    project_cols = [c['name'] for c in inspector.get_columns('projects')] if 'projects' in existing_tables else []
    with op.batch_alter_table('projects', schema=None) as batch_op:
        if 'description' not in project_cols:
            batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        if 'objectives' not in project_cols:
            batch_op.add_column(sa.Column('objectives', sa.Text(), nullable=True))

    # 2. photo_analyses table
    if 'photo_analyses' not in existing_tables:
        op.create_table(
            'photo_analyses',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('project_id', sa.String(), nullable=False),
            sa.Column('filename', sa.String(), nullable=False),
            sa.Column('file_path', sa.String(), nullable=False),
            sa.Column('gps_lat', sa.Float(), nullable=True),
            sa.Column('gps_lon', sa.Float(), nullable=True),
            sa.Column('gps_distance_km', sa.Float(), nullable=True),
            sa.Column('capture_time', sa.DateTime(), nullable=True),
            sa.Column('camera_make', sa.String(), nullable=True),
            sa.Column('camera_model', sa.String(), nullable=True),
            sa.Column('vegetation_fraction', sa.Float(), nullable=True),
            sa.Column('sharpness', sa.Float(), nullable=True),
            sa.Column('resolution_width', sa.Integer(), nullable=True),
            sa.Column('resolution_height', sa.Integer(), nullable=True),
            sa.Column('is_screenshot', sa.Boolean(), default=False, nullable=True),
            sa.Column('is_duplicate', sa.Boolean(), default=False, nullable=True),
            sa.Column('duplicate_match', sa.Text(), nullable=True),
            sa.Column('analysis_status', sa.String(), default='pass', nullable=False),
            sa.Column('flags', sa.Text(), nullable=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('analyzed_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['project_id'], ['projects.project_id']),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('photo_analyses', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_photo_analyses_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_photo_analyses_project_id'), ['project_id'], unique=False)

    # 3. ml_inference_logs table
    if 'ml_inference_logs' not in existing_tables:
        op.create_table(
            'ml_inference_logs',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('model_name', sa.String(), nullable=False),
            sa.Column('model_version', sa.String(), server_default='v1.0', nullable=False),
            sa.Column('project_id', sa.String(), nullable=True),
            sa.Column('inputs_summary', sa.Text(), nullable=True),
            sa.Column('output_result', sa.Text(), nullable=True),
            sa.Column('latency_ms', sa.Float(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('ml_inference_logs', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_ml_inference_logs_id'), ['id'], unique=False)
            batch_op.create_index(batch_op.f('ix_ml_inference_logs_model_name'), ['model_name'], unique=False)
            batch_op.create_index(batch_op.f('ix_ml_inference_logs_project_id'), ['project_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_ml_inference_logs_timestamp'), ['timestamp'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('ml_inference_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ml_inference_logs_timestamp'))
        batch_op.drop_index(batch_op.f('ix_ml_inference_logs_project_id'))
        batch_op.drop_index(batch_op.f('ix_ml_inference_logs_model_name'))
        batch_op.drop_index(batch_op.f('ix_ml_inference_logs_id'))
    op.drop_table('ml_inference_logs')

    with op.batch_alter_table('photo_analyses', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_photo_analyses_project_id'))
        batch_op.drop_index(batch_op.f('ix_photo_analyses_id'))
    op.drop_table('photo_analyses')

    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('objectives')
        batch_op.drop_column('description')
