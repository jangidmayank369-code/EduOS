"""add default report card template

Revision ID: c31e8f7a9021
Revises: b7c4d9e2f611
Create Date: 2026-09-10 15:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c31e8f7a9021"
down_revision = "b7c4d9e2f611"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # ---------------------------------------------------------
    # Do not create duplicate default template
    # ---------------------------------------------------------
    existing = bind.execute(
        sa.text(
            """
            SELECT id
            FROM report_card_templates
            WHERE name = :name
            LIMIT 1
            """
        ),
        {
            "name": "EduOS Standard Academic Report Card",
        },
    ).first()

    if existing:
        return

    # ---------------------------------------------------------
    # Find an admin user to own the template
    # ---------------------------------------------------------
    admin_user = bind.execute(
        sa.text(
            """
            SELECT id
            FROM users
            WHERE LOWER(role) = 'admin'
            ORDER BY id
            LIMIT 1
            """
        )
    ).first()

    if not admin_user:
        # Fallback to the first active user.
        admin_user = bind.execute(
            sa.text(
                """
                SELECT id
                FROM users
                WHERE is_active = true
                ORDER BY id
                LIMIT 1
                """
            )
        ).first()

    if not admin_user:
        raise RuntimeError(
            "Cannot create default report card template because no user exists."
        )

    created_by = admin_user[0]

    # ---------------------------------------------------------
    # A4 canvas
    #
    # 794 x 1123 is used as the editor coordinate system.
    # It scales cleanly to A4 during print/PDF.
    # ---------------------------------------------------------
    elements = [
        {
            "id": "default-school-header",
            "type": "school_header",
            "label": "School Header",
            "x": 42,
            "y": 42,
            "width": 710,
            "height": 142,
            "fontSize": 25,
            "fontWeight": "bold",
            "align": "center",
            "visible": True,
            "imageUrl": "",
            "text": "{{school_name}}",
            "style": {
                "color": "#183B8F",
                "background": "#F4F7FF",
                "borderColor": "#183B8F",
                "borderWidth": 0,
            },
        },
        {
            "id": "default-declaration-date",
            "type": "custom_text",
            "label": "Result Declaration Date",
            "x": 510,
            "y": 194,
            "width": 240,
            "height": 25,
            "fontSize": 9,
            "fontWeight": "600",
            "align": "right",
            "visible": True,
            "text": "Result Declaration Date: {{result_date}}",
            "style": {
                "color": "#475569",
                "background": "transparent",
                "borderWidth": 0,
            },
        },
        {
            "id": "default-student-info",
            "type": "student_info",
            "label": "Student Details",
            "x": 42,
            "y": 225,
            "width": 710,
            "height": 145,
            "fontSize": 10,
            "fontWeight": "normal",
            "align": "left",
            "visible": True,
            "style": {
                "color": "#334155",
                "background": "#F5F8FF",
                "borderColor": "#CBD5E1",
                "borderWidth": 1,
            },
        },
        {
            "id": "default-academic-title",
            "type": "custom_text",
            "label": "Marks Details",
            "x": 42,
            "y": 390,
            "width": 710,
            "height": 30,
            "fontSize": 15,
            "fontWeight": "bold",
            "align": "left",
            "visible": True,
            "text": "Marks Details",
            "style": {
                "color": "#183B8F",
                "background": "transparent",
                "borderWidth": 0,
            },
        },
        {
            "id": "default-academic-table",
            "type": "academic_table",
            "label": "Marks Details",
            "x": 42,
            "y": 420,
            "width": 710,
            "height": 220,
            "fontSize": 9,
            "fontWeight": "normal",
            "align": "left",
            "visible": True,
            "style": {
                "color": "#243044",
                "background": "#FFFFFF",
                "borderColor": "#CBD5E1",
                "borderWidth": 1,
            },
        },
        {
            "id": "default-coscholastic-title",
            "type": "custom_text",
            "label": "Co-Scholastic Subjects",
            "x": 42,
            "y": 650,
            "width": 710,
            "height": 30,
            "fontSize": 15,
            "fontWeight": "bold",
            "align": "left",
            "visible": True,
            "text": "Co-Scholastic Subjects",
            "style": {
                "color": "#183B8F",
                "background": "transparent",
                "borderWidth": 0,
            },
        },
        {
            "id": "default-coscholastic",
            "type": "co_scholastic",
            "label": "Co-Scholastic Subjects",
            "x": 42,
            "y": 680,
            "width": 710,
            "height": 145,
            "fontSize": 9,
            "fontWeight": "normal",
            "align": "left",
            "visible": True,
            "style": {
                "color": "#243044",
                "background": "#FFFFFF",
                "borderColor": "#CBD5E1",
                "borderWidth": 1,
            },
        },
        {
            "id": "default-summary-title",
            "type": "custom_text",
            "label": "Result Summary",
            "x": 42,
            "y": 838,
            "width": 710,
            "height": 30,
            "fontSize": 15,
            "fontWeight": "bold",
            "align": "left",
            "visible": True,
            "text": "Result Summary",
            "style": {
                "color": "#183B8F",
                "background": "transparent",
                "borderWidth": 0,
            },
        },
        {
            "id": "default-summary",
            "type": "summary",
            "label": "Result Summary",
            "x": 42,
            "y": 868,
            "width": 710,
            "height": 75,
            "fontSize": 10,
            "fontWeight": "bold",
            "align": "center",
            "visible": True,
            "style": {
                "color": "#243044",
                "background": "#FFFFFF",
                "borderColor": "#CBD5E1",
                "borderWidth": 1,
            },
        },
        {
            "id": "default-attendance",
            "type": "attendance",
            "label": "Attendance",
            "x": 42,
            "y": 953,
            "width": 710,
            "height": 62,
            "fontSize": 9,
            "fontWeight": "normal",
            "align": "left",
            "visible": True,
            "style": {
                "color": "#334155",
                "background": "#F8FAFC",
                "borderColor": "#CBD5E1",
                "borderWidth": 1,
            },
        },
        {
            "id": "default-remarks",
            "type": "remarks",
            "label": "Remarks",
            "x": 42,
            "y": 1023,
            "width": 710,
            "height": 48,
            "fontSize": 8,
            "fontWeight": "normal",
            "align": "left",
            "visible": True,
            "style": {
                "color": "#334155",
                "background": "#FFFFFF",
                "borderColor": "#CBD5E1",
                "borderWidth": 0,
            },
        },
        {
            "id": "default-signatures",
            "type": "signatures",
            "label": "Signatures",
            "x": 42,
            "y": 1072,
            "width": 710,
            "height": 38,
            "fontSize": 9,
            "fontWeight": "normal",
            "align": "center",
            "visible": True,
            "style": {
                "color": "#183B8F",
                "background": "transparent",
                "borderWidth": 0,
            },
        },
    ]

    settings = {
        "version": 1,

        "page": {
            "size": "A4",
            "orientation": "portrait",
            "width": 794,
            "height": 1123,
            "margin": 24,
            "overflow": "hidden",
        },

        "theme": {
            "primary": "#183B8F",
            "secondary": "#2857C8",
            "accent": "#2D63D7",
            "gold": "#C9A84E",
            "headerBg": "#F4F7FF",
            "tableHeader": "#2857C8",
            "softBg": "#F5F8FF",
            "border": "#CBD5E1",
            "text": "#243044",
            "fontFamily": "Arial",
        },

        "school": {
            "name": "Wisdom Public School",
            "tagline": "Foundation for a Bright Future",
            "address": "",
            "phone": "",
            "email": "",
            "logoUrl": "",
        },

        "report": {
            "title": "ACADEMIC REPORT CARD",
            "declarationDate": True,
        },

        "academic": {
            "enabled": True,
            "title": "Marks Details",
            "subjects": [
                {
                    "id": "hindi",
                    "name": "Hindi",
                    "maxMarks": 100,
                    "passMarks": 33,
                    "gradeBased": False,
                },
                {
                    "id": "english",
                    "name": "English",
                    "maxMarks": 100,
                    "passMarks": 33,
                    "gradeBased": False,
                },
                {
                    "id": "mathematics",
                    "name": "Mathematics",
                    "maxMarks": 100,
                    "passMarks": 33,
                    "gradeBased": False,
                },
                {
                    "id": "evs",
                    "name": "Environmental Studies",
                    "maxMarks": 100,
                    "passMarks": 33,
                    "gradeBased": False,
                },
            ],
        },

        "co_scholastic": {
            "enabled": True,
            "title": "Co-Scholastic Subjects",
            "subjects": [
                {
                    "id": "social-service",
                    "name": "Social Service",
                    "gradeBased": True,
                },
                {
                    "id": "physical-health",
                    "name": "Physical & Health Education",
                    "gradeBased": True,
                },
                {
                    "id": "art",
                    "name": "Art Education",
                    "gradeBased": True,
                },
                {
                    "id": "gk",
                    "name": "General Knowledge",
                    "gradeBased": True,
                },
            ],
        },

        "attendance": {
            "enabled": True,
            "title": "Attendance",
        },

        "remarks": {
            "enabled": True,
            "title": "Remarks",
        },

        "signatures": {
            "enabled": True,
            "classTeacher": "Class Teacher",
            "head": "Head of Institution",
            "examIncharge": "Examination In-Charge",
        },

        "print": {
            "fitToPage": True,
            "onePage": True,
            "overflow": "hidden",
            "printBackground": True,
            "scale": 100,
        },
    }

    bind.execute(
        sa.text(
            """
            INSERT INTO report_card_templates (
                name,
                description,
                class_id,
                academic_session_id,
                exam_id,
                page_size,
                orientation,
                status,
                is_default,
                elements,
                settings,
                created_by,
                created_at,
                updated_at
            )
            VALUES (
                :name,
                :description,
                NULL,
                NULL,
                NULL,
                :page_size,
                :orientation,
                :status,
                :is_default,
                CAST(:elements AS jsonb),
                CAST(:settings AS jsonb),
                :created_by,
                NOW(),
                NOW()
            )
            """
        ),
        {
            "name": "EduOS Standard Academic Report Card",
            "description": (
                "Default A4 academic report card template "
                "with school header, logo, student details, "
                "academic marks, co-scholastic, result summary, "
                "attendance, remarks and signatures."
            ),
            "page_size": "A4",
            "orientation": "portrait",
            "status": "DRAFT",
            "is_default": True,
            "elements": postgresql.JSONB().bind_processor(
                bind.dialect
            )(elements),
            "settings": postgresql.JSONB().bind_processor(
                bind.dialect
            )(settings),
            "created_by": created_by,
        },
    )


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            DELETE FROM report_card_templates
            WHERE name = :name
            """
        ),
        {
            "name": "EduOS Standard Academic Report Card",
        },
    )