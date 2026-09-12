"""create teacher attendance and leave tables

Revision ID: 91f2c4e8a6b3
Revises: 8c91e3f7a2b4
Create Date: 2026-09-12
"""

from alembic import op
import sqlalchemy as sa


revision = "91f2c4e8a6b3"
down_revision = "8c91e3f7a2b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "teacher_leaves" not in tables:
        op.create_table(
            "teacher_leaves",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "teacher_id",
                sa.Integer(),
                sa.ForeignKey("teachers.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("leave_type", sa.String(length=30), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column(
                "reviewed_by_user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

        op.create_index(
            "ix_teacher_leaves_teacher_id",
            "teacher_leaves",
            ["teacher_id"],
        )
        op.create_index(
            "ix_teacher_leaves_start_date",
            "teacher_leaves",
            ["start_date"],
        )
        op.create_index(
            "ix_teacher_leaves_end_date",
            "teacher_leaves",
            ["end_date"],
        )
        op.create_index(
            "ix_teacher_leaves_status",
            "teacher_leaves",
            ["status"],
        )
        op.create_index(
            "ix_teacher_leaves_reviewed_by_user_id",
            "teacher_leaves",
            ["reviewed_by_user_id"],
        )

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "teacher_attendance" not in tables:
        op.create_table(
            "teacher_attendance",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "teacher_id",
                sa.Integer(),
                sa.ForeignKey("teachers.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("attendance_date", sa.Date(), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("check_in", sa.Time(), nullable=True),
            sa.Column("check_out", sa.Time(), nullable=True),
            sa.Column(
                "leave_id",
                sa.Integer(),
                sa.ForeignKey("teacher_leaves.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint(
                "teacher_id",
                "attendance_date",
                name="uq_teacher_attendance_teacher_date",
            ),
        )

        op.create_index(
            "ix_teacher_attendance_teacher_id",
            "teacher_attendance",
            ["teacher_id"],
        )
        op.create_index(
            "ix_teacher_attendance_attendance_date",
            "teacher_attendance",
            ["attendance_date"],
        )
        op.create_index(
            "ix_teacher_attendance_leave_id",
            "teacher_attendance",
            ["leave_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "teacher_attendance" in tables:
        op.drop_index(
            "ix_teacher_attendance_leave_id",
            table_name="teacher_attendance",
        )
        op.drop_index(
            "ix_teacher_attendance_attendance_date",
            table_name="teacher_attendance",
        )
        op.drop_index(
            "ix_teacher_attendance_teacher_id",
            table_name="teacher_attendance",
        )
        op.drop_table("teacher_attendance")

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "teacher_leaves" in tables:
        op.drop_index(
            "ix_teacher_leaves_reviewed_by_user_id",
            table_name="teacher_leaves",
        )
        op.drop_index(
            "ix_teacher_leaves_status",
            table_name="teacher_leaves",
        )
        op.drop_index(
            "ix_teacher_leaves_end_date",
            table_name="teacher_leaves",
        )
        op.drop_index(
            "ix_teacher_leaves_start_date",
            table_name="teacher_leaves",
        )
        op.drop_index(
            "ix_teacher_leaves_teacher_id",
            table_name="teacher_leaves",
        )
        op.drop_table("teacher_leaves")
