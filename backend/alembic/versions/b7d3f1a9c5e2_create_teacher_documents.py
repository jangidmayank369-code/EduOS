"""create teacher documents

Revision ID:  b7d3f1a9c5e2
Revises:     a4c9e7f2b6d1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7d3f1a9c5e2"
down_revision: Union[str, Sequence[str], None] = "a4c9e7f2b6d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "teacher_documents" not in inspector.get_table_names():
        op.create_table(
            "teacher_documents",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column(
                "teacher_id",
                sa.Integer(),
                sa.ForeignKey("teachers.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("document_type", sa.String(length=50), nullable=False),
            sa.Column("document_name", sa.String(length=200), nullable=False),
            sa.Column("document_number", sa.String(length=100), nullable=True),
            sa.Column("issue_date", sa.Date(), nullable=True),
            sa.Column("expiry_date", sa.Date(), nullable=True),
            sa.Column("file_url", sa.Text(), nullable=True),
            sa.Column("file_name", sa.String(length=255), nullable=True),
            sa.Column("mime_type", sa.String(length=100), nullable=True),
            sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column(
                "verified_by_user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("verified_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

        op.create_index(
            "ix_teacher_documents_teacher_id",
            "teacher_documents",
            ["teacher_id"],
        )
        op.create_index(
            "ix_teacher_documents_document_type",
            "teacher_documents",
            ["document_type"],
        )
        op.create_index(
            "ix_teacher_documents_expiry_date",
            "teacher_documents",
            ["expiry_date"],
        )
        op.create_index(
            "ix_teacher_documents_is_verified",
            "teacher_documents",
            ["is_verified"],
        )
        op.create_index(
            "ix_teacher_documents_is_active",
            "teacher_documents",
            ["is_active"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "teacher_documents" in inspector.get_table_names():
        op.drop_index("ix_teacher_documents_is_active", table_name="teacher_documents")
        op.drop_index("ix_teacher_documents_is_verified", table_name="teacher_documents")
        op.drop_index("ix_teacher_documents_expiry_date", table_name="teacher_documents")
        op.drop_index("ix_teacher_documents_document_type", table_name="teacher_documents")
        op.drop_index("ix_teacher_documents_teacher_id", table_name="teacher_documents")
        op.drop_table("teacher_documents")
