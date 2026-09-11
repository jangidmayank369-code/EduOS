"""create final result system

Revision ID: a12d7e9f4c21
Revises: 8f31a6c2d901
Create Date: 2026-09-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a12d7e9f4c21"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "8f31a6c2d901"

branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None

depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


def upgrade() -> None:
    op.create_table(
        "result_configurations",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "name",
            sa.String(length=150),
            nullable=False,
        ),

        sa.Column(
            "class_id",
            sa.Integer(),
            sa.ForeignKey("classes.id"),
            nullable=False,
        ),

        sa.Column(
            "academic_session_id",
            sa.Integer(),
            sa.ForeignKey("academic_sessions.id"),
            nullable=True,
        ),

        sa.Column(
            "term",
            sa.String(length=50),
            nullable=True,
        ),

        sa.Column(
            "calculation_method",
            sa.String(length=30),
            server_default="WEIGHTED",
            nullable=False,
        ),

        sa.Column(
            "best_of_count",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "status",
            sa.String(length=20),
            server_default="DRAFT",
            nullable=False,
        ),

        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),

        sa.Column(
            "published_at",
            sa.DateTime(),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_result_configurations_class_id",
        "result_configurations",
        ["class_id"],
    )

    op.create_index(
        "ix_result_configurations_academic_session_id",
        "result_configurations",
        ["academic_session_id"],
    )

    op.create_table(
        "result_configuration_exams",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "configuration_id",
            sa.Integer(),
            sa.ForeignKey(
                "result_configurations.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "exam_id",
            sa.Integer(),
            sa.ForeignKey("exams.id"),
            nullable=False,
        ),

        sa.Column(
            "weightage",
            sa.Float(),
            server_default="0",
            nullable=False,
        ),

        sa.Column(
            "include_in_result",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),

        sa.UniqueConstraint(
            "configuration_id",
            "exam_id",
            name="uq_result_config_exam",
        ),
    )

    op.create_index(
        "ix_result_configuration_exams_configuration_id",
        "result_configuration_exams",
        ["configuration_id"],
    )

    op.create_index(
        "ix_result_configuration_exams_exam_id",
        "result_configuration_exams",
        ["exam_id"],
    )

    op.create_table(
        "final_results",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "configuration_id",
            sa.Integer(),
            sa.ForeignKey(
                "result_configurations.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id"),
            nullable=False,
        ),

        sa.Column(
            "total_marks",
            sa.Float(),
            server_default="0",
            nullable=False,
        ),

        sa.Column(
            "max_marks",
            sa.Float(),
            server_default="0",
            nullable=False,
        ),

        sa.Column(
            "percentage",
            sa.Float(),
            server_default="0",
            nullable=False,
        ),

        sa.Column(
            "grade",
            sa.String(length=10),
            server_default="F",
            nullable=False,
        ),

        sa.Column(
            "rank",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "is_pass",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),

        sa.Column(
            "is_locked",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),

        sa.Column(
            "is_published",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),

        sa.Column(
            "published_at",
            sa.DateTime(),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_final_results_configuration_id",
        "final_results",
        ["configuration_id"],
    )

    op.create_index(
        "ix_final_results_student_id",
        "final_results",
        ["student_id"],
    )

    op.create_table(
        "final_result_subjects",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "final_result_id",
            sa.Integer(),
            sa.ForeignKey(
                "final_results.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "subject_id",
            sa.Integer(),
            sa.ForeignKey("subjects.id"),
            nullable=False,
        ),

        sa.Column(
            "total_marks",
            sa.Float(),
            server_default="0",
            nullable=False,
        ),

        sa.Column(
            "max_marks",
            sa.Float(),
            server_default="0",
            nullable=False,
        ),

        sa.Column(
            "percentage",
            sa.Float(),
            server_default="0",
            nullable=False,
        ),

        sa.Column(
            "grade",
            sa.String(length=10),
            server_default="F",
            nullable=False,
        ),

        sa.Column(
            "is_pass",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_final_result_subjects_final_result_id",
        "final_result_subjects",
        ["final_result_id"],
    )

    op.create_index(
        "ix_final_result_subjects_subject_id",
        "final_result_subjects",
        ["subject_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_final_result_subjects_subject_id",
        table_name="final_result_subjects",
    )

    op.drop_index(
        "ix_final_result_subjects_final_result_id",
        table_name="final_result_subjects",
    )

    op.drop_table("final_result_subjects")

    op.drop_index(
        "ix_final_results_student_id",
        table_name="final_results",
    )

    op.drop_index(
        "ix_final_results_configuration_id",
        table_name="final_results",
    )

    op.drop_table("final_results")

    op.drop_index(
        "ix_result_configuration_exams_exam_id",
        table_name="result_configuration_exams",
    )

    op.drop_index(
        "ix_result_configuration_exams_configuration_id",
        table_name="result_configuration_exams",
    )

    op.drop_table("result_configuration_exams")

    op.drop_index(
        "ix_result_configurations_academic_session_id",
        table_name="result_configurations",
    )

    op.drop_index(
        "ix_result_configurations_class_id",
        table_name="result_configurations",
    )

    op.drop_table("result_configurations")