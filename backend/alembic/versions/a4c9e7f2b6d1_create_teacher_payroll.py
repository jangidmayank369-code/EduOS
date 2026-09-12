"""create teacher salary structure and payroll tables

Revision ID: a4c9e7f2b6d1
Revises: 91f2c4e8a6b3
Create Date: 2026-09-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a4c9e7f2b6d1"
down_revision = "91f2c4e8a6b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "teacher_salary_structures" not in tables:
        op.create_table(
            "teacher_salary_structures",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("teacher_id", sa.Integer(), nullable=False),
            sa.Column("effective_from", sa.Date(), nullable=False),
            sa.Column("effective_to", sa.Date(), nullable=True),
            sa.Column("basic_salary", sa.Numeric(12, 2), nullable=False),
            sa.Column("allowances", sa.JSON(), nullable=False),
            sa.Column("deductions", sa.JSON(), nullable=False),
            sa.Column("payroll_type", sa.String(length=30), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["teacher_id"],
                ["teachers.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "teacher_id",
                "effective_from",
                name="uq_teacher_salary_structure_teacher_effective_from",
            ),
        )
        op.create_index(
            "ix_teacher_salary_structures_teacher_id",
            "teacher_salary_structures",
            ["teacher_id"],
        )
        op.create_index(
            "ix_teacher_salary_structures_effective_from",
            "teacher_salary_structures",
            ["effective_from"],
        )
        op.create_index(
            "ix_teacher_salary_structures_effective_to",
            "teacher_salary_structures",
            ["effective_to"],
        )

    tables = set(sa.inspect(bind).get_table_names())
    if "teacher_payrolls" not in tables:
        op.create_table(
            "teacher_payrolls",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("teacher_id", sa.Integer(), nullable=False),
            sa.Column("salary_structure_id", sa.Integer(), nullable=True),
            sa.Column("payroll_year", sa.Integer(), nullable=False),
            sa.Column("payroll_month", sa.Integer(), nullable=False),
            sa.Column("basic_salary", sa.Numeric(12, 2), nullable=False),
            sa.Column("allowances_snapshot", sa.JSON(), nullable=False),
            sa.Column("deductions_snapshot", sa.JSON(), nullable=False),
            sa.Column("gross_salary", sa.Numeric(12, 2), nullable=False),
            sa.Column("total_deductions", sa.Numeric(12, 2), nullable=False),
            sa.Column("net_salary", sa.Numeric(12, 2), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("processed_by_user_id", sa.Integer(), nullable=True),
            sa.Column("processed_at", sa.DateTime(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["teacher_id"],
                ["teachers.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["salary_structure_id"],
                ["teacher_salary_structures.id"],
                ondelete="SET NULL",
            ),
            sa.ForeignKeyConstraint(
                ["processed_by_user_id"],
                ["users.id"],
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "teacher_id",
                "payroll_year",
                "payroll_month",
                name="uq_teacher_payroll_teacher_year_month",
            ),
        )
        op.create_index("ix_teacher_payrolls_teacher_id", "teacher_payrolls", ["teacher_id"])
        op.create_index("ix_teacher_payrolls_salary_structure_id", "teacher_payrolls", ["salary_structure_id"])
        op.create_index("ix_teacher_payrolls_payroll_year", "teacher_payrolls", ["payroll_year"])
        op.create_index("ix_teacher_payrolls_payroll_month", "teacher_payrolls", ["payroll_month"])
        op.create_index("ix_teacher_payrolls_status", "teacher_payrolls", ["status"])

    tables = set(sa.inspect(bind).get_table_names())
    if "teacher_payslips" not in tables:
        op.create_table(
            "teacher_payslips",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("payroll_id", sa.Integer(), nullable=False),
            sa.Column("payslip_number", sa.String(length=80), nullable=False),
            sa.Column("issue_date", sa.Date(), nullable=False),
            sa.Column("earnings_snapshot", sa.JSON(), nullable=False),
            sa.Column("deductions_snapshot", sa.JSON(), nullable=False),
            sa.Column("net_salary", sa.Numeric(12, 2), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["payroll_id"],
                ["teacher_payrolls.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("payroll_id"),
            sa.UniqueConstraint("payslip_number"),
        )
        op.create_index("ix_teacher_payslips_payroll_id", "teacher_payslips", ["payroll_id"])
        op.create_index("ix_teacher_payslips_payslip_number", "teacher_payslips", ["payslip_number"])
        op.create_index("ix_teacher_payslips_status", "teacher_payslips", ["status"])

    tables = set(sa.inspect(bind).get_table_names())
    if "teacher_payments" not in tables:
        op.create_table(
            "teacher_payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("payroll_id", sa.Integer(), nullable=False),
            sa.Column("payment_date", sa.Date(), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("payment_method", sa.String(length=30), nullable=False),
            sa.Column("transaction_reference", sa.String(length=120), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["payroll_id"],
                ["teacher_payrolls.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["created_by_user_id"],
                ["users.id"],
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_teacher_payments_payroll_id", "teacher_payments", ["payroll_id"])
        op.create_index("ix_teacher_payments_payment_date", "teacher_payments", ["payment_date"])
        op.create_index("ix_teacher_payments_transaction_reference", "teacher_payments", ["transaction_reference"])
        op.create_index("ix_teacher_payments_status", "teacher_payments", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "teacher_payments" in tables:
        op.drop_table("teacher_payments")
    if "teacher_payslips" in tables:
        op.drop_table("teacher_payslips")
    if "teacher_payrolls" in tables:
        op.drop_table("teacher_payrolls")
    if "teacher_salary_structures" in tables:
        op.drop_table("teacher_salary_structures")
