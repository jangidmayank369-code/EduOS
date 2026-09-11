/* eslint-disable @next/next/no-img-element */
"use client";

import React, { CSSProperties } from "react";

type Theme = {
  primary?: string;
  secondary?: string;
  accent?: string;
  gold?: string;
  headerBg?: string;
  tableHeader?: string;
  softBg?: string;
  border?: string;
  text?: string;
  muted?: string;
  success?: string;
  fontFamily?: string;
  borderRadius?: number;
};

type Assessment = {
  id?: string | number;
  label?: string;
  assessment?: string;
  component?: "WRITTEN" | "ORAL" | "OTHER" | string;
  exam_id?: number | null;
  exam_name?: string;
  max_marks?: number | null;
  pass_marks?: number | null;
  marks_obtained?: number | null;
  percentage?: number | null;
  grade?: string | null;
  remark?: string | null;
  enabled?: boolean;
  display_order?: number;
};

type AcademicSubject = {
  id?: number | string;
  subject_id?: number | string;
  subject_name?: string;
  name?: string;
  code?: string;
  max_marks?: number | null;
  pass_marks?: number | null;
  marks_obtained?: number | null;
  percentage?: number | null;
  grade?: string | null;
  remark?: string | null;
  calculation_complete?: boolean;
  assessments?: Assessment[];
};

type Student = {
  id?: number | string;
  name?: string;
  first_name?: string;
  last_name?: string;
  father_name?: string;
  fatherName?: string;
  admission_number?: string;
  admissionNo?: string;
  roll_number?: string | number;
  rollNo?: string | number;
  class_name?: string;
  section?: string;
};

type ReportCard = {
  student?: Student;
  class_name?: string;
  section?: string;
  exam?: { id?: number; name?: string };
  academic_session?: { id?: number; name?: string; session_name?: string };
  academic_subjects?: AcademicSubject[];
  co_scholastic?: any[];
  attendance?: {
    working_days?: number | null;
    present_days?: number | null;
    absent_days?: number | null;
    percentage?: number | null;
    total_working_days?: number | null;
    days_present?: number | null;
  };
  result?: {
    total_marks?: number | null;
    obtained_marks?: number | null;
    max_marks?: number | null;
    percentage?: number | null;
    grade?: string | null;
    division?: string | null;
    result?: string | null;
    rank?: number | null;
    is_pass?: boolean | null;
    calculation_complete?: boolean;
    missing_assessments?: string[];
  };
  remarks?: any;
  signatures?: any;
  template?: {
    name?: string;
    page_size?: string;
    orientation?: string;
    settings?: Record<string, any>;
    elements?: Element[];
  };
};

/** Public data shape used by the student report-card route. */
export type ReportCardData = ReportCard;

type Template = {
  page_size?: string;
  orientation?: string;
  settings?: Record<string, any>;
  elements?: any[];
};

type Element = {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  text?: string;
  fontSize?: number;
  fontWeight?: string | number;
  align?: string;
  style?: Record<string, any>;
  props?: Record<string, any>;
};

type RendererProps = {
  report?: ReportCard;
  reports?: ReportCard[];
  template?: Template | ReportCard["template"];
  element?: Element;
  mode?: "builder" | "preview" | "print" | "view";
};

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const valueAsNumber = Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : null;
}

function fmt(value: unknown): string {
  const valueAsNumber = n(value);
  if (valueAsNumber === null) return "-";
  return Number.isInteger(valueAsNumber)
    ? String(valueAsNumber)
    : valueAsNumber.toFixed(2);
}

function studentName(student?: Student): string {
  if (!student) return "";
  return (
    student.name ||
    [student.first_name, student.last_name].filter(Boolean).join(" ") ||
    (student.id ? `Student #${student.id}` : "")
  );
}

function gradeClass(grade?: string | null): string {
  const value = str(grade).toUpperCase();
  if (value === "A+" || value === "A1") return "bg-green-100 text-green-800";
  if (value === "A") return "bg-emerald-100 text-emerald-800";
  if (value === "B+" || value === "B") return "bg-blue-100 text-blue-800";
  if (value === "C+" || value === "C") return "bg-yellow-100 text-yellow-800";
  if (value === "D") return "bg-orange-100 text-orange-800";
  if (value === "E" || value === "F") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

function resultClass(result?: string | null): string {
  const value = str(result).toUpperCase();
  if (["PASS", "PASSED", "PROMOTED"].includes(value)) {
    return "bg-green-100 text-green-800";
  }
  if (["FAIL", "FAILED"].includes(value)) {
    return "bg-red-100 text-red-800";
  }
  return "bg-gray-100 text-gray-700";
}

function themeFor(template?: Template | ReportCard["template"]): Theme {
  const settings = template?.settings || {};
  return {
    primary: "#1e3a8a",
    secondary: "#475569",
    accent: "#1d4ed8",
    gold: "#b45309",
    headerBg: "#f8fafc",
    tableHeader: "#f1f5f9",
    softBg: "#f8fafc",
    border: "#111827",
    text: "#111827",
    muted: "#64748b",
    success: "#166534",
    fontFamily: "Arial, Helvetica, sans-serif",
    borderRadius: 0,
    ...(settings.theme || {}),
  };
}

function getSettings(template?: Template | ReportCard["template"]) {
  return template?.settings || {};
}

function assessmentKey(a: Assessment): string {
  const label =
    str(a.label) || str(a.assessment) || str(a.exam_name) || "Assessment";
  const component = str(a.component) || "OTHER";
  return `${a.exam_id ?? ""}|${label}|${component}`
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function assessmentColumns(report?: ReportCard): Assessment[] {
  if (!report) return [];

  const settings = getSettings(report.template);
  const configured = Array.isArray(settings.assessments)
    ? settings.assessments
    : [];

  const result: Assessment[] = [];
  const seen = new Set<string>();

  const add = (item: Assessment) => {
    if (item.enabled === false) return;
    const key = assessmentKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  };

  configured
    .slice()
    .sort(
      (a: Assessment, b: Assessment) =>
        Number(a.display_order || 0) - Number(b.display_order || 0)
    )
    .forEach(add);

  (report.academic_subjects || []).forEach((subject) => {
    (subject.assessments || []).forEach(add);
  });

  return result;
}

function subjectName(subject: AcademicSubject): string {
  return subject.subject_name || subject.name || subject.code || "Subject";
}

function subjectList(report?: ReportCard): AcademicSubject[] {
  const configured =
    (getSettings(report?.template).academic_subjects as any[]) || [];

  const subjects: AcademicSubject[] = [];
  const seen = new Set<string>();

  configured.forEach((config) => {
    if (config?.enabled === false) return;
    const key = String(config.subject_id ?? config.id ?? config.name ?? "");
    if (key && !seen.has(key)) {
      seen.add(key);
      subjects.push({
        subject_id: config.subject_id,
        subject_name: config.name,
        name: config.name,
        code: config.code,
        max_marks: config.max_marks,
        pass_marks: config.pass_marks,
      });
    }
  });

  (report?.academic_subjects || []).forEach((subject) => {
    const key = String(
      subject.subject_id ?? subject.id ?? subjectName(subject)
    ).toLowerCase();

    const existing = subjects.find(
      (item) =>
        String(item.subject_id ?? item.id ?? "").toLowerCase() === key ||
        subjectName(item).toLowerCase() === subjectName(subject).toLowerCase()
    );

    if (existing) {
      Object.assign(existing, subject);
    } else {
      subjects.push(subject);
    }
  });

  return subjects;
}

function findAssessment(
  subject: AcademicSubject | undefined,
  column: Assessment
): Assessment | undefined {
  return (subject?.assessments || []).find(
    (item) => assessmentKey(item) === assessmentKey(column)
  );
}

function completeSubject(subject?: AcademicSubject): boolean {
  if (!subject) return false;
  if (subject.calculation_complete === false) return false;

  const assessments = subject.assessments || [];
  if (!assessments.length) return n(subject.marks_obtained) !== null;

  return assessments.every((item) => n(item.marks_obtained) !== null);
}

function fallbackGrade(percentage: number | null): string {
  if (percentage === null) return "Pending";
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

function calculateTotals(report?: ReportCard) {
  let obtained = 0;
  let maximum = 0;
  let complete = true;

  (report?.academic_subjects || []).forEach((subject) => {
    const max = n(subject.max_marks);
    const obtainedMarks = n(subject.marks_obtained);

    if (max !== null) maximum += max;
    if (obtainedMarks !== null) {
      obtained += obtainedMarks;
    } else {
      complete = false;
    }

    if (!completeSubject(subject)) complete = false;
  });

  return {
    obtained,
    maximum,
    percentage:
      maximum > 0 && complete ? (obtained / maximum) * 100 : null,
    complete,
  };
}

function elementStyle(
  element: Element,
  theme: Theme
): CSSProperties {
  const style = element.style || {};

  return {
    position: "absolute",
    left: element.x ?? 0,
    top: element.y ?? 0,
    width: element.width ?? 200,
    height: element.height ?? 50,
    zIndex: element.zIndex ?? 1,
    display: element.visible === false ? "none" : undefined,
    boxSizing: "border-box",
    fontSize: element.fontSize ?? 11,
    fontWeight: element.fontWeight ?? "normal",
    textAlign: (element.align || style.textAlign || "left") as any,
    color: style.color || theme.text,
    background: style.background || "transparent",
    border:
      style.borderWidth !== undefined
        ? `${style.borderWidth}px solid ${
            style.borderColor || theme.border
          }`
        : undefined,
    borderRadius:
      style.radius !== undefined
        ? style.radius
        : theme.borderRadius,
    padding: style.padding ?? 6,
    overflow: "hidden",
    ...style,
  };
}

function SchoolHeader({
  report,
  settings,
  theme,
  style,
}: {
  report: ReportCard;
  settings: Record<string, any>;
  theme: Theme;
  style?: CSSProperties;
}) {
  const school = settings.school || {};
  const name = school.name || "WISDOM PUBLIC SCHOOL";
  const address = school.address || "DOOMARA, NAWALGARH";

  return (
    <div
      style={{
        ...style,
        textAlign: "center",
        borderBottom: `2px solid ${theme.border}`,
      }}
    >
      {school.logoUrl && (
        <img
          src={school.logoUrl}
          alt="School Logo"
          className="mx-auto mb-1 h-12 w-12 object-contain"
        />
      )}

      <div className="text-xl font-bold">{name}</div>
      {school.tagline && (
        <div className="text-[10px] font-semibold">{school.tagline}</div>
      )}
      <div className="text-[10px]">{address}</div>

      {(school.phone || school.email || school.website) && (
        <div className="mt-1 text-[8px]">
          {[school.phone, school.email, school.website]
            .filter(Boolean)
            .join(" • ")}
        </div>
      )}

      <div className="mt-2 text-sm font-bold uppercase">
        {report.exam?.name || "STUDENT PROGRESS REPORT"}
      </div>
    </div>
  );
}

function StudentDetails({
  report,
  style,
}: {
  report: ReportCard;
  style?: CSSProperties;
}) {
  const student = report.student;

  return (
    <div
      style={style}
      className="grid grid-cols-2 gap-x-4 gap-y-1 border border-black text-[9px]"
    >
      <div>
        <b>Student Name:</b> {studentName(student)}
      </div>
      <div>
        <b>Father&apos;s Name:</b>{" "}
        {student?.father_name || student?.fatherName || "-"}
      </div>
      <div>
        <b>Admission No:</b>{" "}
        {student?.admission_number || student?.admissionNo || "-"}
      </div>
      <div>
        <b>Roll No:</b>{" "}
        {student?.roll_number ?? student?.rollNo ?? "-"}
      </div>
      <div>
        <b>Class:</b> {report.class_name || student?.class_name || "-"}
      </div>
      <div>
        <b>Section:</b> {report.section || student?.section || "-"}
      </div>
    </div>
  );
}

function AcademicTable({
  report,
  settings,
  theme,
  style,
}: {
  report: ReportCard;
  settings: Record<string, any>;
  theme: Theme;
  style?: CSSProperties;
}) {
  const subjects = subjectList(report);
  const columns = assessmentColumns(report);
  const academic = settings.academic || {};
  const showAssessments = columns.length > 0;

  if (academic.enabled === false) return null;

  return (
    <div style={style} className="overflow-hidden">
      <div
        className="mb-1 text-xs font-bold uppercase"
        style={{ color: theme.text }}
      >
        {academic.title || "Academic Performance"}
      </div>

      <table
        className="w-full border-collapse border border-black"
        style={{ fontFamily: theme.fontFamily }}
      >
        <thead>
          <tr style={{ background: theme.tableHeader }}>
            <th className="border border-black px-1 py-1 text-[8px]">
              S.No.
            </th>
            <th className="border border-black px-2 py-1 text-left text-[8px]">
              Subject
            </th>

            {showAssessments &&
              columns.map((column) => (
                <th
                  key={assessmentKey(column)}
                  className="border border-black px-1 py-1 text-[7px]"
                >
                  <div>
                    {column.label ||
                      column.assessment ||
                      column.exam_name ||
                      "Assessment"}
                  </div>
                  {column.component &&
                    column.component !== "OTHER" && (
                      <div className="text-[6px] uppercase">
                        {column.component}
                      </div>
                    )}
                </th>
              ))}

            {academic.showMaxMarks !== false && (
              <th className="border border-black px-1 py-1 text-[8px]">
                Max
              </th>
            )}
            {academic.showPassMarks && (
              <th className="border border-black px-1 py-1 text-[8px]">
                Pass
              </th>
            )}
            {academic.showObtained !== false && (
              <th className="border border-black px-1 py-1 text-[8px]">
                Obt.
              </th>
            )}
            {academic.showGrade !== false && (
              <th className="border border-black px-1 py-1 text-[8px]">
                Grade
              </th>
            )}
            {academic.showRemark && (
              <th className="border border-black px-1 py-1 text-[8px]">
                Remark
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {subjects.map((subject, index) => {
            const complete = completeSubject(subject);
            const percentage =
              n(subject.percentage) ??
              (complete &&
              n(subject.max_marks) &&
              n(subject.marks_obtained) !== null
                ? (Number(subject.marks_obtained) /
                    Number(subject.max_marks)) *
                  100
                : null);
            const grade = complete
              ? subject.grade || fallbackGrade(percentage)
              : "Pending";

            return (
              <tr key={`${subject.subject_id ?? subject.id}-${index}`}>
                <td className="border border-black px-1 py-1 text-center text-[8px]">
                  {index + 1}
                </td>

                <td className="border border-black px-2 py-1 text-[8px] font-semibold">
                  {subjectName(subject)}
                  {subject.code && (
                    <span className="ml-1 text-[6px] text-gray-500">
                      ({subject.code})
                    </span>
                  )}
                </td>

                {showAssessments &&
                  columns.map((column) => {
                    const assessment = findAssessment(subject, column);
                    return (
                      <td
                        key={`${subjectName(subject)}-${assessmentKey(column)}`}
                        className="border border-black px-1 py-1 text-center text-[7px]"
                      >
                        {assessment?.marks_obtained !== null &&
                        assessment?.marks_obtained !== undefined
                          ? fmt(assessment.marks_obtained)
                          : "Pending"}
                        {assessment?.max_marks !== null &&
                          assessment?.max_marks !== undefined && (
                            <div className="text-[6px] text-gray-500">
                              /{fmt(assessment.max_marks)}
                            </div>
                          )}
                      </td>
                    );
                  })}

                {academic.showMaxMarks !== false && (
                  <td className="border border-black px-1 py-1 text-center text-[8px]">
                    {fmt(subject.max_marks)}
                  </td>
                )}

                {academic.showPassMarks && (
                  <td className="border border-black px-1 py-1 text-center text-[8px]">
                    {fmt(subject.pass_marks)}
                  </td>
                )}

                {academic.showObtained !== false && (
                  <td className="border border-black px-1 py-1 text-center text-[8px] font-semibold">
                    {complete
                      ? fmt(subject.marks_obtained)
                      : "Pending"}
                  </td>
                )}

                {academic.showGrade !== false && (
                  <td className="border border-black px-1 py-1 text-center text-[8px]">
                    {grade === "Pending" ? (
                      "Pending"
                    ) : (
                      <span
                        className={`inline-flex min-w-[25px] justify-center rounded px-1 py-0.5 font-bold ${gradeClass(
                          grade
                        )}`}
                      >
                        {grade}
                      </span>
                    )}
                  </td>
                )}

                {academic.showRemark && (
                  <td className="border border-black px-1 py-1 text-center text-[7px]">
                    {subject.remark || "-"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultSummary({
  report,
  settings,
  style,
}: {
  report: ReportCard;
  settings: Record<string, any>;
  style?: CSSProperties;
}) {
  const config = settings.result || {};
  if (config.enabled === false) return null;

  const totals = calculateTotals(report);
  const result = report.result || {};
  const complete =
    totals.complete && result.calculation_complete !== false;

  const percentage = n(result.percentage) ?? totals.percentage;
  const grade =
    complete && percentage !== null
      ? result.grade || fallbackGrade(percentage)
      : "Pending";

  return (
    <div style={style}>
      <div className="mb-1 text-xs font-bold uppercase">
        {config.title || "Result Summary"}
      </div>

      <div className="grid grid-cols-2 gap-1 border border-black text-[8px] md:grid-cols-4">
        {config.showTotal !== false && (
          <div className="border-r border-black px-2 py-1">
            <b>Total:</b>{" "}
            {complete
              ? fmt(result.obtained_marks ?? totals.obtained)
              : "Pending"}{" "}
            / {fmt(result.max_marks ?? totals.maximum)}
          </div>
        )}

        {config.showPercentage !== false && (
          <div className="border-r border-black px-2 py-1">
            <b>Percentage:</b>{" "}
            {complete && percentage !== null
              ? `${fmt(percentage)}%`
              : "Pending"}
          </div>
        )}

        {config.showGrade !== false && (
          <div className="border-r border-black px-2 py-1">
            <b>Grade:</b>{" "}
            {grade === "Pending" ? (
              "Pending"
            ) : (
              <span
                className={`rounded px-1 py-0.5 font-bold ${gradeClass(
                  grade
                )}`}
              >
                {grade}
              </span>
            )}
          </div>
        )}

        {config.showDivision !== false && (
          <div className="px-2 py-1">
            <b>Division:</b> {complete ? result.division || "-" : "Pending"}
          </div>
        )}

        {config.showResult !== false && (
          <div className="border-t border-black px-2 py-1">
            <b>Result:</b>{" "}
            {complete ? (
              <span
                className={`rounded px-1 py-0.5 font-bold ${resultClass(
                  result.result ||
                    (result.is_pass ? "PASS" : "FAIL")
                )}`}
              >
                {result.result ||
                  (result.is_pass ? "PASS" : "FAIL")}
              </span>
            ) : (
              "Pending"
            )}
          </div>
        )}

        {config.showRank && (
          <div className="border-t border-black px-2 py-1">
            <b>Rank:</b> {result.rank ?? "-"}
          </div>
        )}
      </div>
    </div>
  );
}

function Attendance({
  report,
  settings,
  style,
}: {
  report: ReportCard;
  settings: Record<string, any>;
  style?: CSSProperties;
}) {
  const config = settings.attendance || {};
  if (config.enabled === false) return null;

  const attendance = report.attendance || {};
  const working =
    attendance.working_days ?? attendance.total_working_days;
  const present =
    attendance.present_days ?? attendance.days_present;
  const percentage =
    attendance.percentage ??
    (n(working) && n(present) !== null
      ? (Number(present) / Number(working)) * 100
      : null);

  return (
    <div style={style} className="border border-black text-[8px]">
      <div className="border-b border-black px-2 py-1 font-bold">
        Attendance
      </div>
      <div className="grid grid-cols-3">
        {config.showWorkingDays !== false && (
          <div className="border-r border-black px-2 py-1">
            <b>Working Days:</b> {fmt(working)}
          </div>
        )}
        {config.showPresentDays !== false && (
          <div className="border-r border-black px-2 py-1">
            <b>Present:</b> {fmt(present)}
          </div>
        )}
        {config.showPercentage !== false && (
          <div className="px-2 py-1">
            <b>Attendance %:</b>{" "}
            {percentage === null ? "-" : `${fmt(percentage)}%`}
          </div>
        )}
      </div>
    </div>
  );
}

function CoScholastic({
  report,
  settings,
  style,
}: {
  report: ReportCard;
  settings: Record<string, any>;
  style?: CSSProperties;
}) {
  const config = settings.co_scholastic || {};
  if (config.enabled === false) return null;

  const configured = Array.isArray(config.subjects)
    ? config.subjects
    : Array.isArray(settings.co_scholastic_subjects)
      ? settings.co_scholastic_subjects
      : [];

  const data = Array.isArray(report.co_scholastic)
    ? report.co_scholastic
    : [];

  if (!configured.length && !data.length) return null;

  return (
    <div style={style}>
      <div className="mb-1 text-xs font-bold uppercase">
        {config.title || "Co-Scholastic"}
      </div>
      <table className="w-full border-collapse border border-black text-[8px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-2 py-1 text-left">
              Activity
            </th>
            {config.showGrade !== false && (
              <th className="border border-black px-2 py-1">Grade</th>
            )}
            {config.showRemark && (
              <th className="border border-black px-2 py-1">Remark</th>
            )}
          </tr>
        </thead>
        <tbody>
          {(configured.length ? configured : data).map(
            (item: any, index: number) => {
              const actual =
                data.find(
                  (entry: any) =>
                    entry.component_id === item.component_id ||
                    entry.id === item.id ||
                    entry.name === item.name
                ) || item;

              return (
                <tr key={`${item.id ?? item.component_id ?? index}`}>
                  <td className="border border-black px-2 py-1">
                    {item.name ||
                      actual.name ||
                      actual.component_name ||
                      "Activity"}
                  </td>
                  {config.showGrade !== false && (
                    <td className="border border-black px-2 py-1 text-center">
                      {actual.grade ||
                        actual.value ||
                        actual.rating ||
                        "-"}
                    </td>
                  )}
                  {config.showRemark && (
                    <td className="border border-black px-2 py-1">
                      {actual.remark || "-"}
                    </td>
                  )}
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}

function Remarks({
  report,
  settings,
  style,
}: {
  report: ReportCard;
  settings: Record<string, any>;
  style?: CSSProperties;
}) {
  const config = settings.remarks || {};
  if (config.enabled === false) return null;

  const remarks = report.remarks || {};
  const classTeacher =
    typeof remarks === "string"
      ? remarks
      : remarks.class_teacher ??
        remarks.classTeacher ??
        remarks.teacher ??
        "";

  const principal =
    typeof remarks === "string"
      ? ""
      : remarks.principal ?? remarks.principal_remark ?? "";

  return (
    <div style={style} className="border border-black text-[8px]">
      <div className="border-b border-black px-2 py-1 font-bold">
        Remarks
      </div>

      {config.classTeacher !== false && (
        <div className="border-b border-black px-2 py-2">
          <b>Class Teacher:</b> {classTeacher || "-"}
        </div>
      )}

      {config.principal && (
        <div className="px-2 py-2">
          <b>Principal:</b> {principal || "-"}
        </div>
      )}
    </div>
  );
}

function Signatures({
  report,
  settings,
  style,
}: {
  report: ReportCard;
  settings: Record<string, any>;
  style?: CSSProperties;
}) {
  const config = settings.signatures || {};
  if (config.enabled === false) return null;

  const signatures = report.signatures || {};

  return (
    <div
      style={style}
      className="grid grid-cols-3 gap-8 pt-8 text-center text-[8px]"
    >
      {config.classTeacher !== false && (
        <div className="border-t border-black pt-1">
          {signatures.class_teacher_name ||
            signatures.classTeacherName ||
            "Class Teacher"}
        </div>
      )}

      {config.principal !== false && (
        <div className="border-t border-black pt-1">
          {signatures.principal_name ||
            signatures.principalName ||
            "Principal"}
        </div>
      )}

      {config.parent && (
        <div className="border-t border-black pt-1">
          {signatures.parent_name ||
            signatures.parentName ||
            "Parent / Guardian"}
        </div>
      )}
    </div>
  );
}

function CustomText({
  element,
  report,
  style,
}: {
  element: Element;
  report: ReportCard;
  style?: CSSProperties;
}) {
  const source =
    element.text ||
    element.props?.text ||
    element.props?.content ||
    "";

  const resolved = source
    .replace(/\{\{\s*student\.name\s*\}\}/gi, studentName(report.student))
    .replace(
      /\{\{\s*student\.father_name\s*\}\}/gi,
      report.student?.father_name || report.student?.fatherName || ""
    )
    .replace(
      /\{\{\s*student\.admission_number\s*\}\}/gi,
      report.student?.admission_number ||
        report.student?.admissionNo ||
        ""
    )
    .replace(
      /\{\{\s*student\.roll_number\s*\}\}/gi,
      str(report.student?.roll_number ?? report.student?.rollNo)
    )
    .replace(
      /\{\{\s*class_name\s*\}\}/gi,
      report.class_name || report.student?.class_name || ""
    )
    .replace(
      /\{\{\s*section\s*\}\}/gi,
      report.section || report.student?.section || ""
    )
    .replace(
      /\{\{\s*exam_name\s*\}\}/gi,
      report.exam?.name || ""
    );

  return <div style={style}>{resolved || "Custom text"}</div>;
}

function Divider({
  style,
}: {
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        ...style,
        borderTop: "1px solid currentColor",
        height: 1,
        padding: 0,
      }}
    />
  );
}

/**
 * Shared renderer used by the template builder.
 *
 * IMPORTANT:
 * The named export is intentionally preserved because the feature-rich
 * builder imports ReportCardElementRenderer by name.
 */
export function ReportCardElementRenderer({
  element,
  template,
  mode = "view",
  report,
  data,
}: {
  element: Element;
  template: Template | ReportCard["template"];
  mode?: "builder" | "preview" | "print" | "view";
  report?: ReportCard;
  data?: ReportCardData;
}) {
  const safeReport: ReportCard =
    report || data || {
      student: {
        name: "Sample Student",
        father_name: "Sample Father",
        admission_number: "ADM-001",
        roll_number: 1,
      },
      class_name: "Class",
      section: "A",
      exam: { name: "Examination" },
      academic_subjects: [
        {
          subject_name: "English",
          max_marks: 100,
          pass_marks: 40,
          marks_obtained: 78,
          percentage: 78,
          grade: "B+",
          calculation_complete: true,
          assessments: [],
        },
        {
          subject_name: "Mathematics",
          max_marks: 100,
          pass_marks: 40,
          marks_obtained: 85,
          percentage: 85,
          grade: "A",
          calculation_complete: true,
          assessments: [],
        },
      ],
      result: {
        max_marks: 200,
        obtained_marks: 163,
        percentage: 81.5,
        grade: "A",
        result: "PASS",
        calculation_complete: true,
      },
    };

  const settings = getSettings(template);
  const theme = themeFor(template);
  const type = element.type || "custom_text";
  const style = elementStyle(element, theme);

  switch (type) {
    case "school_header":
      return (
        <SchoolHeader
          report={safeReport}
          settings={settings}
          theme={theme}
          style={style}
        />
      );

    case "report_title":
      return (
        <div style={style} className="text-center font-bold uppercase">
          {element.props?.title ||
            element.props?.text ||
            "STUDENT PROGRESS REPORT"}
        </div>
      );

    case "result_date":
      return (
        <div style={style}>
          <b>Date:</b>{" "}
          {element.props?.date ||
            new Date().toLocaleDateString("en-IN")}
        </div>
      );

    case "student_details":
    case "student_info":
      return <StudentDetails report={safeReport} style={style} />;

    case "academic_table":
      return (
        <AcademicTable
          report={safeReport}
          settings={settings}
          theme={theme}
          style={style}
        />
      );

    case "co_scholastic":
      return (
        <CoScholastic
          report={safeReport}
          settings={settings}
          style={style}
        />
      );

    case "result_summary":
    case "summary":
      return (
        <ResultSummary
          report={safeReport}
          settings={settings}
          style={style}
        />
      );

    case "attendance":
      return (
        <Attendance
          report={safeReport}
          settings={settings}
          style={style}
        />
      );

    case "remarks":
      return (
        <Remarks
          report={safeReport}
          settings={settings}
          style={style}
        />
      );

    case "signatures":
      return (
        <Signatures
          report={safeReport}
          settings={settings}
          style={style}
        />
      );

    case "logo":
      return settings.school?.logoUrl ? (
        <img
          src={settings.school.logoUrl}
          alt="School Logo"
          style={style}
          className="object-contain"
        />
      ) : null;

    case "section_heading":
      return (
        <div style={style} className="font-bold uppercase">
          {element.props?.title ||
            element.props?.text ||
            element.text ||
            "Section"}
        </div>
      );

    case "divider":
      return <Divider style={style} />;

    case "custom_text":
    default:
      return (
        <CustomText
          element={element}
          report={safeReport}
          style={style}
        />
      );
  }
}

function ReportCardPage({
  report,
  template,
  mode = "view",
}: {
  report: ReportCard;
  template: Template;
  mode?: "builder" | "preview" | "print" | "view";
}) {
  const settings = getSettings(template);
  const theme = themeFor(template);

  const page = settings.page || {};
  const orientation =
    template?.orientation || page.orientation || "portrait";

  const defaultWidth = orientation === "landscape" ? 1123 : 794;
  const defaultHeight = orientation === "landscape" ? 794 : 1123;

  const width = Number(
    page.width ||
      (orientation === "landscape" ? 297 : 210)
  );
  const height = Number(
    page.height ||
      (orientation === "landscape" ? 210 : 297)
  );

  const elements = Array.isArray(template?.elements)
    ? template.elements
    : [];

  if (elements.length) {
    return (
      <div
        className="relative mx-auto overflow-hidden bg-white text-black"
        style={{
          width: page.pixelWidth || defaultWidth,
          minHeight: page.pixelHeight || defaultHeight,
          fontFamily: theme.fontFamily,
          paddingTop: page.marginTop ?? 24,
          paddingRight: page.marginRight ?? 24,
          paddingBottom: page.marginBottom ?? 24,
          paddingLeft: page.marginLeft ?? 24,
          ["--report-page-width" as any]: `${width}mm`,
          ["--report-page-height" as any]: `${height}mm`,
        }}
        data-report-orientation={orientation}
      >
        {elements
          .filter((element: Element) => element.visible !== false)
          .slice()
          .sort(
            (a: Element, b: Element) =>
              Number(a.zIndex || 0) - Number(b.zIndex || 0)
          )
          .map((element: Element) => (
            <ReportCardElementRenderer
              key={element.id}
              element={element}
              template={template}
              mode={mode}
              report={report}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      className="mx-auto bg-white p-6 text-black"
      style={{
        width: page.pixelWidth || defaultWidth,
        minHeight: page.pixelHeight || defaultHeight,
        fontFamily: theme.fontFamily,
      }}
    >
      <ReportCardElementRenderer
        element={{
          id: "school_header",
          type: "school_header",
          x: 0,
          y: 0,
          width: defaultWidth - 48,
          height: 100,
        }}
        template={template}
        report={report}
        mode={mode}
      />

      <div className="mt-3">
        <ReportCardElementRenderer
          element={{
            id: "student_details",
            type: "student_details",
            x: 0,
            y: 0,
            width: defaultWidth - 48,
            height: 70,
          }}
          template={template}
          report={report}
          mode={mode}
        />
      </div>

      <div className="mt-3">
        <ReportCardElementRenderer
          element={{
            id: "academic_table",
            type: "academic_table",
            x: 0,
            y: 0,
            width: defaultWidth - 48,
            height: 400,
          }}
          template={template}
          report={report}
          mode={mode}
        />
      </div>

      <div className="mt-3">
        <ReportCardElementRenderer
          element={{
            id: "result_summary",
            type: "result_summary",
            x: 0,
            y: 0,
            width: defaultWidth - 48,
            height: 100,
          }}
          template={template}
          report={report}
          mode={mode}
        />
      </div>
    </div>
  );
}

export default function ReportCardRenderer({
  report,
  reports,
  template,
  mode = "view",
}: RendererProps) {
  if (reports?.length) {
    return (
      <div className="space-y-4">
        {reports.map((item, index) => (
          <div
            key={str(item.student?.id) || `report-${index}`}
            className="report-card-page"
          >
            <ReportCardPage
              report={item}
              template={(template || item.template || {}) as Template}
              mode={mode}
            />
          </div>
        ))}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="border border-black bg-white p-8 text-center text-sm">
        Report card data is not available.
      </div>
    );
  }

  return (
    <ReportCardPage
      report={report}
      template={(template || report.template || {}) as Template}
      mode={mode}
    />
  );
}
