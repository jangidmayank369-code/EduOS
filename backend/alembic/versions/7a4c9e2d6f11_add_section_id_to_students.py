"""add section_id to students

Revision ID: 7a4c9e2d6f11
Revises: 6f8c2d4a1b90
Create Date: 2026-09-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7a4c9e2d6f11"
down_revision: Union[str, Sequence[str], None] = "6f8c2d4a1b90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nullable section_id to students."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {column["name"] for column in inspector.get_columns("students")}

    if "section_id" not in columns:
        op.add_column(
            "students",
            sa.Column("section_id", sa.Integer(), nullable=True),
        )

    foreign_keys = inspector.get_foreign_keys("students")
    has_section_fk = any(
        fk.get("referred_table") == "sections"
        and fk.get("constrained_columns") == ["section_id"]
        for fk in foreign_keys
    )

    if not has_section_fk:
        op.create_foreign_key(
            "fk_students_section_id_sections",
            "students",
            "sections",
            ["section_id"],
            ["id"],
        )

    indexes = inspector.get_indexes("students")
    has_section_index = any(
        index.get("name") == "ix_students_section_id"
        for index in indexes
    )

    if not has_section_index:
        op.create_index(
            "ix_students_section_id",
            "students",
            ["section_id"],
            unique=False,
        )


def downgrade() -> None:
    """Remove section_id from students."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    indexes = inspector.get_indexes("students")
    if any(index.get("name") == "ix_students_section_id" for index in indexes):
        op.drop_index("ix_students_section_id", table_name="students")

    foreign_keys = inspector.get_foreign_keys("students")
    for fk in foreign_keys:
        if (
            fk.get("name") == "fk_students_section_id_sections"
            or (
                fk.get("referred_table") == "sections"
                and fk.get("constrained_columns") == ["section_id"]
            )
        ):
            if fk.get("name"):
                op.drop_constraint(
                    fk["name"],
                    "students",
                    type_="foreignkey",
                )

    columns = {column["name"] for column in inspector.get_columns("students")}
    if "section_id" in columns:
        op.drop_column("students", "section_id")
