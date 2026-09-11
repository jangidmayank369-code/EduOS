"""seed rbac roles and permissions

Revision ID: 4ad832541b77
Revises: e9ffd5293b7c
Create Date: 2026-09-09

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4ad832541b77"
down_revision: Union[str, Sequence[str], None] = "e9ffd5293b7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLES = [
    (
        "SUPER_ADMIN",
        "Full system access and school administration",
    ),
    (
        "ADMIN",
        "School administration and daily operations",
    ),
    (
        "TEACHER",
        "Teaching, attendance, assignments and academic operations",
    ),
    (
        "ACCOUNTANT",
        "Fees, payments and financial operations",
    ),
    (
        "RECEPTIONIST",
        "Admissions, student and parent front-office operations",
    ),
    (
        "PARENT",
        "Access to own profile and linked children",
    ),
    (
        "STUDENT",
        "Access to own academic information",
    ),
]


PERMISSIONS = [
    # Students
    ("students.view", "View Students", "students"),
    ("students.create", "Create Students", "students"),
    ("students.update", "Update Students", "students"),
    ("students.delete", "Deactivate Students", "students"),
    ("students.export", "Export Students", "students"),

    # Parents
    ("parents.view", "View Parents", "parents"),
    ("parents.create", "Create Parents", "parents"),
    ("parents.update", "Update Parents", "parents"),
    ("parents.delete", "Deactivate Parents", "parents"),
    ("parents.manage_children", "Manage Parent Children", "parents"),

    # Teachers / Staff
    ("teachers.view", "View Teachers", "teachers"),
    ("teachers.create", "Create Teachers", "teachers"),
    ("teachers.update", "Update Teachers", "teachers"),
    ("teachers.delete", "Deactivate Teachers", "teachers"),

    # Classes
    ("classes.view", "View Classes", "classes"),
    ("classes.create", "Create Classes", "classes"),
    ("classes.update", "Update Classes", "classes"),
    ("classes.delete", "Deactivate Classes", "classes"),
    ("classes.manage_subjects", "Manage Class Subjects", "classes"),

    # Subjects
    ("subjects.view", "View Subjects", "subjects"),
    ("subjects.create", "Create Subjects", "subjects"),
    ("subjects.update", "Update Subjects", "subjects"),
    ("subjects.delete", "Deactivate Subjects", "subjects"),

    # Teacher assignments
    (
        "teacher_assignments.view",
        "View Teacher Assignments",
        "teacher_assignments",
    ),
    (
        "teacher_assignments.create",
        "Create Teacher Assignments",
        "teacher_assignments",
    ),
    (
        "teacher_assignments.delete",
        "Delete Teacher Assignments",
        "teacher_assignments",
    ),

    # Attendance
    ("attendance.view", "View Attendance", "attendance"),
    ("attendance.mark", "Mark Attendance", "attendance"),
    ("attendance.update", "Update Attendance", "attendance"),

    # Exams
    ("exams.view", "View Exams", "exams"),
    ("exams.create", "Create Exams", "exams"),
    ("exams.update", "Update Exams", "exams"),
    ("exams.delete", "Delete Exams", "exams"),

    # Marks / Results
    ("marks.view", "View Marks", "marks"),
    ("marks.create", "Enter Marks", "marks"),
    ("marks.update", "Update Marks", "marks"),
    ("marks.delete", "Delete Marks", "marks"),

    ("results.view", "View Results", "results"),
    ("results.create", "Create Results", "results"),
    ("results.update", "Update Results", "results"),
    ("results.publish", "Publish Results", "results"),

    # Assignments
    ("assignments.view", "View Assignments", "assignments"),
    ("assignments.create", "Create Assignments", "assignments"),
    ("assignments.update", "Update Assignments", "assignments"),
    ("assignments.delete", "Delete Assignments", "assignments"),
    ("assignments.grade", "Grade Assignments", "assignments"),

    # Admissions
    ("admissions.view", "View Admissions", "admissions"),
    ("admissions.create", "Create Admissions", "admissions"),
    ("admissions.update", "Update Admissions", "admissions"),
    ("admissions.review", "Review Admissions", "admissions"),
    ("admissions.approve", "Approve Admissions", "admissions"),
    ("admissions.admit", "Complete Admission", "admissions"),
    ("admissions.cancel", "Cancel Admissions", "admissions"),

    # Academic sessions
    ("academic_sessions.view", "View Academic Sessions", "academic_sessions"),
    ("academic_sessions.create", "Create Academic Sessions", "academic_sessions"),
    ("academic_sessions.update", "Update Academic Sessions", "academic_sessions"),
    ("academic_sessions.delete", "Deactivate Academic Sessions", "academic_sessions"),

    # Fees
    ("fees.view", "View Fees", "fees"),
    ("fees.create", "Create Fees", "fees"),
    ("fees.update", "Update Fees", "fees"),
    ("fees.delete", "Deactivate Fees", "fees"),
    ("fees.generate", "Generate Fees", "fees"),
    ("fees.collect", "Collect Fee Payments", "fees"),
    ("fees.export", "Export Fee Data", "fees"),

    # Fee structures
    ("fee_structures.view", "View Fee Structures", "fee_structures"),
    ("fee_structures.create", "Create Fee Structures", "fee_structures"),
    ("fee_structures.update", "Update Fee Structures", "fee_structures"),
    ("fee_structures.delete", "Deactivate Fee Structures", "fee_structures"),

    # Fee payments
    ("fee_payments.view", "View Fee Payments", "fee_payments"),
    ("fee_payments.create", "Record Fee Payments", "fee_payments"),
    ("fee_payments.view_receipt", "View Fee Receipts", "fee_payments"),

    # Notices
    ("notices.view", "View Notices", "notices"),
    ("notices.create", "Create Notices", "notices"),
    ("notices.update", "Update Notices", "notices"),
    ("notices.delete", "Delete Notices", "notices"),

    # Notifications
    ("notifications.view", "View Notifications", "notifications"),
    ("notifications.create", "Create Notifications", "notifications"),
    ("notifications.send", "Send Notifications", "notifications"),

    # Timetable
    ("timetable.view", "View Timetable", "timetable"),
    ("timetable.create", "Create Timetable", "timetable"),
    ("timetable.update", "Update Timetable", "timetable"),
    ("timetable.delete", "Delete Timetable", "timetable"),

    # Dashboard
    ("dashboard.view", "View Dashboard", "dashboard"),

    # Bulk operations
    ("students.bulk_import", "Bulk Import Students", "students"),
    ("students.bulk_update", "Bulk Update Students", "students"),
]


# Permissions assigned to each default role.
#
# SUPER_ADMIN gets everything.
# Other roles receive only the permissions appropriate to their
# operational responsibilities.
ROLE_PERMISSIONS = {
    "ADMIN": [
        "students.view",
        "students.create",
        "students.update",
        "students.delete",
        "students.export",
        "students.bulk_import",
        "students.bulk_update",

        "parents.view",
        "parents.create",
        "parents.update",
        "parents.delete",
        "parents.manage_children",

        "teachers.view",
        "teachers.create",
        "teachers.update",
        "teachers.delete",

        "classes.view",
        "classes.create",
        "classes.update",
        "classes.delete",
        "classes.manage_subjects",

        "subjects.view",
        "subjects.create",
        "subjects.update",
        "subjects.delete",

        "teacher_assignments.view",
        "teacher_assignments.create",
        "teacher_assignments.delete",

        "attendance.view",
        "attendance.mark",
        "attendance.update",

        "exams.view",
        "exams.create",
        "exams.update",
        "exams.delete",

        "marks.view",
        "marks.create",
        "marks.update",
        "marks.delete",

        "results.view",
        "results.create",
        "results.update",
        "results.publish",

        "assignments.view",
        "assignments.create",
        "assignments.update",
        "assignments.delete",
        "assignments.grade",

        "admissions.view",
        "admissions.create",
        "admissions.update",
        "admissions.review",
        "admissions.approve",
        "admissions.admit",
        "admissions.cancel",

        "academic_sessions.view",
        "academic_sessions.create",
        "academic_sessions.update",
        "academic_sessions.delete",

        "fees.view",
        "fees.create",
        "fees.update",
        "fees.delete",
        "fees.generate",
        "fees.collect",
        "fees.export",

        "fee_structures.view",
        "fee_structures.create",
        "fee_structures.update",
        "fee_structures.delete",

        "fee_payments.view",
        "fee_payments.create",
        "fee_payments.view_receipt",

        "notices.view",
        "notices.create",
        "notices.update",
        "notices.delete",

        "notifications.view",
        "notifications.create",
        "notifications.send",

        "timetable.view",
        "timetable.create",
        "timetable.update",
        "timetable.delete",

        "dashboard.view",
    ],

    "TEACHER": [
        "students.view",

        "parents.view",

        "classes.view",
        "subjects.view",

        "teacher_assignments.view",

        "attendance.view",
        "attendance.mark",
        "attendance.update",

        "exams.view",

        "marks.view",
        "marks.create",
        "marks.update",

        "results.view",

        "assignments.view",
        "assignments.create",
        "assignments.update",
        "assignments.grade",

        "notices.view",
        "notifications.view",

        "timetable.view",

        "dashboard.view",
    ],

    "ACCOUNTANT": [
        "students.view",
        "parents.view",

        "classes.view",

        "fees.view",
        "fees.create",
        "fees.update",
        "fees.generate",
        "fees.collect",
        "fees.export",

        "fee_structures.view",
        "fee_structures.create",
        "fee_structures.update",
        "fee_structures.delete",

        "fee_payments.view",
        "fee_payments.create",
        "fee_payments.view_receipt",

        "notifications.view",

        "dashboard.view",
    ],

    "RECEPTIONIST": [
        "students.view",
        "students.create",
        "students.update",

        "parents.view",
        "parents.create",
        "parents.update",
        "parents.manage_children",

        "classes.view",

        "admissions.view",
        "admissions.create",
        "admissions.update",
        "admissions.review",

        "academic_sessions.view",

        "notices.view",
        "notifications.view",

        "dashboard.view",
    ],

    "PARENT": [
        "students.view",
        "parents.view",

        "attendance.view",
        "marks.view",
        "results.view",

        "assignments.view",

        "fees.view",
        "fee_payments.view_receipt",

        "notices.view",
        "notifications.view",

        "dashboard.view",
    ],

    "STUDENT": [
        "students.view",

        "attendance.view",
        "marks.view",
        "results.view",

        "assignments.view",

        "notices.view",
        "notifications.view",

        "timetable.view",

        "dashboard.view",
    ],
}


def upgrade() -> None:
    connection = op.get_bind()

    # ---------------------------------------------------------
    # 1. Insert default roles
    # ---------------------------------------------------------
    for role_name, description in ROLES:
        existing = connection.execute(
            sa.text(
                """
                SELECT id
                FROM roles
                WHERE name = :name
                """
            ),
            {"name": role_name},
        ).scalar()

        if existing is None:
            connection.execute(
                sa.text(
                    """
                    INSERT INTO roles
                        (name, description, is_active, created_at, updated_at)
                    VALUES
                        (:name, :description, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                ),
                {
                    "name": role_name,
                    "description": description,
                },
            )

    # ---------------------------------------------------------
    # 2. Insert permissions
    # ---------------------------------------------------------
    for code, name, module in PERMISSIONS:
        existing = connection.execute(
            sa.text(
                """
                SELECT id
                FROM permissions
                WHERE code = :code
                """
            ),
            {"code": code},
        ).scalar()

        if existing is None:
            connection.execute(
                sa.text(
                    """
                    INSERT INTO permissions
                        (code, name, module, description, is_active, created_at)
                    VALUES
                        (:code, :name, :module, :description, TRUE, CURRENT_TIMESTAMP)
                    """
                ),
                {
                    "code": code,
                    "name": name,
                    "module": module,
                    "description": f"Permission for {name.lower()}",
                },
            )

    # ---------------------------------------------------------
    # 3. SUPER_ADMIN gets every permission
    # ---------------------------------------------------------
    super_admin_id = connection.execute(
        sa.text(
            """
            SELECT id
            FROM roles
            WHERE name = 'SUPER_ADMIN'
            """
        )
    ).scalar_one()

    permission_rows = connection.execute(
        sa.text(
            """
            SELECT id
            FROM permissions
            WHERE is_active = TRUE
            """
        )
    ).fetchall()

    for (permission_id,) in permission_rows:
        connection.execute(
            sa.text(
                """
                INSERT INTO role_permissions
                    (role_id, permission_id, allowed, created_at)
                VALUES
                    (:role_id, :permission_id, TRUE, CURRENT_TIMESTAMP)
                ON CONFLICT (role_id, permission_id) DO NOTHING
                """
            ),
            {
                "role_id": super_admin_id,
                "permission_id": permission_id,
            },
        )

    # ---------------------------------------------------------
    # 4. Assign permissions to remaining default roles
    # ---------------------------------------------------------
    for role_name, permission_codes in ROLE_PERMISSIONS.items():
        role_id = connection.execute(
            sa.text(
                """
                SELECT id
                FROM roles
                WHERE name = :name
                """
            ),
            {"name": role_name},
        ).scalar_one()

        for permission_code in permission_codes:
            permission_id = connection.execute(
                sa.text(
                    """
                    SELECT id
                    FROM permissions
                    WHERE code = :code
                    """
                ),
                {"code": permission_code},
            ).scalar_one()

            connection.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions
                        (role_id, permission_id, allowed, created_at)
                    VALUES
                        (:role_id, :permission_id, TRUE, CURRENT_TIMESTAMP)
                    ON CONFLICT (role_id, permission_id) DO NOTHING
                    """
                ),
                {
                    "role_id": role_id,
                    "permission_id": permission_id,
                },
            )


def downgrade() -> None:
    connection = op.get_bind()

    connection.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE role_id IN (
                SELECT id
                FROM roles
                WHERE name IN (
                    'SUPER_ADMIN',
                    'ADMIN',
                    'TEACHER',
                    'ACCOUNTANT',
                    'RECEPTIONIST',
                    'PARENT',
                    'STUDENT'
                )
            )
            """
        )
    )

    connection.execute(
        sa.text(
            """
            DELETE FROM permissions
            WHERE code IN :codes
            """
        ).bindparams(
            sa.bindparam("codes", expanding=True)
        ),
        {
            "codes": [permission[0] for permission in PERMISSIONS],
        },
    )

    connection.execute(
        sa.text(
            """
            DELETE FROM roles
            WHERE name IN :names
            """
        ).bindparams(
            sa.bindparam("names", expanding=True)
        ),
        {
            "names": [role[0] for role in ROLES],
        },
    )