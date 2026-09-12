from alembic import op
import sqlalchemy as sa


revision = "c5e7a1f9b3d2"
down_revision = "b7d3f1a9c5e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    inspector = sa.inspect(bind)

    if "teacher_tasks" in inspector.get_table_names():
        return

    op.create_table(
        "teacher_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "teacher_id",
            sa.Integer(),
            sa.ForeignKey(
                "teachers.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "assigned_by_user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="RESTRICT",
            ),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "task_type",
            sa.String(length=40),
            nullable=False,
            server_default="GENERAL",
        ),
        sa.Column(
            "priority",
            sa.String(length=20),
            nullable=False,
            server_default="MEDIUM",
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="ASSIGNED",
        ),
        sa.Column(
            "progress_percent",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "due_date",
            sa.Date(),
            nullable=True,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "submitted_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "reviewed_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "reviewed_by_user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "teacher_remarks",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "admin_remarks",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "teacher_id",
            "title",
            "due_date",
            name="uq_teacher_task_teacher_title_due_date",
        ),
    )

    op.create_index(
        "ix_teacher_tasks_teacher_id",
        "teacher_tasks",
        ["teacher_id"],
    )

    op.create_index(
        "ix_teacher_tasks_assigned_by_user_id",
        "teacher_tasks",
        ["assigned_by_user_id"],
    )

    op.create_index(
        "ix_teacher_tasks_status",
        "teacher_tasks",
        ["status"],
    )

    op.create_index(
        "ix_teacher_tasks_due_date",
        "teacher_tasks",
        ["due_date"],
    )

    op.create_index(
        "ix_teacher_tasks_reviewed_by_user_id",
        "teacher_tasks",
        ["reviewed_by_user_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()

    inspector = sa.inspect(bind)

    if "teacher_tasks" not in inspector.get_table_names():
        return

    op.drop_index(
        "ix_teacher_tasks_reviewed_by_user_id",
        table_name="teacher_tasks",
    )
    op.drop_index(
        "ix_teacher_tasks_due_date",
        table_name="teacher_tasks",
    )
    op.drop_index(
        "ix_teacher_tasks_status",
        table_name="teacher_tasks",
    )
    op.drop_index(
        "ix_teacher_tasks_assigned_by_user_id",
        table_name="teacher_tasks",
    )
    op.drop_index(
        "ix_teacher_tasks_teacher_id",
        table_name="teacher_tasks",
    )
    op.drop_table("teacher_tasks")
