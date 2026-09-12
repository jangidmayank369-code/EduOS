from app.models.user import User
from app.models.student import Student
from app.models.school_class import SchoolClass
from app.models.school_section import SchoolSection
from app.models.subject import Subject
from app.models.class_subject import ClassSubject
from app.models.teacher import Teacher
from app.models.teacher_assignment import TeacherAssignment
from app.models.attendance import Attendance
from app.models.exam import Exam
from app.models.exam_subject import ExamSubject
from app.models.mark import Mark
from app.models.parent import Parent
from app.models.parent_child import ParentChild
from app.models.fee import Fee
from app.models.fee_payment import FeePayment
from app.models.fee_structure import FeeStructure
from app.models.notice import Notice
from app.models.timetable import Timetable
from app.models.timetable_period import TimetablePeriod
from app.models.section_timetable import SectionTimetable
from app.models.section_subject_teacher import SectionSubjectTeacher
from app.models.assignment import Assignment
from app.models.assignment_submission import AssignmentSubmission
from app.models.notification import Notification
from app.models.result import Result
from app.models.final_result import FinalResult
from app.models.academic_session import AcademicSession
from app.models.student_status_history import StudentStatusHistory
from app.models.import_job import ImportJob
from app.models.admission_application import AdmissionApplication
from app.models.student_enrollment import StudentEnrollment
from app.models.parent_invitation import ParentInvitation
from app.models.co_scholastic import CoScholasticComponent, CoScholasticEntry
from app.models.exam_schedule import ExamSchedule
from app.models.mark_component import MarkComponent
from app.models.report_card_template import ReportCardTemplate
from app.models.result_configuration import ResultConfiguration
from app.models.result_configuration_exam import ResultConfigurationExam
from app.models.rbac import Role, Permission, RolePermission
from app.models.teacher_employment_profile import TeacherEmploymentProfile
from app.models.teacher_attendance import TeacherAttendance
from app.models.teacher_leave import TeacherLeave
from app.models.teacher_salary import (
    TeacherSalaryStructure,
    TeacherPayroll,
    TeacherPayslip,
    TeacherPayment,
)
from app.models.teacher_document import TeacherDocument
from app.models.teacher_task import TeacherTask