"use client";

import React from "react";

type Assessment = {
  id?: string | number;
  label?: string;
  assessment?: string;
  component?: string;
  exam_id?: number | null;
  exam_name?: string;
  max_marks?: number | null;
  marks_obtained?: number | null;
  enabled?: boolean;
  display_order?: number;
};

type Subject = {
  id?: number | string;
  subject_id?: number | string;
  subject_name?: string;
  name?: string;
  code?: string;
  max_marks?: number | null;
  marks_obtained?: number | null;
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
  roll_number?: string | number;
};

type Report = {
  student?: Student;
  academic_subjects?: Subject[];
  result?: {
    obtained_marks?: number | null;
    max_marks?: number | null;
    percentage?: number | null;
    grade?: string | null;
    result?: string | null;
    rank?: number | null;
    calculation_complete?: boolean;
    is_pass?: boolean | null;
  };
  exam?: { id?: number; name?: string };
  template?: {
    settings?: {
      school?: {
        name?: string;
        address?: string;
      };
      assessments?: Assessment[];
    };
  };
};

type Props = {
  reports: Report[];
  title?: string;
  schoolName?: string;
  schoolAddress?: string;
  examName?: string;
  showAssessments?: boolean;
  showResult?: boolean;
};

function text(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(v: unknown) {
  const n = num(v);
  return n === null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function studentName(s?: Student) {
  if (!s) return "";
  return s.name || [s.first_name, s.last_name].filter(Boolean).join(" ");
}

function gradeClass(g?: string | null) {
  const grade = text(g).toUpperCase();
  if (grade === "A+" || grade === "A1") return "bg-green-100 text-green-800";
  if (grade === "A") return "bg-emerald-100 text-emerald-800";
  if (grade === "B+" || grade === "B") return "bg-blue-100 text-blue-800";
  if (grade === "C+" || grade === "C") return "bg-yellow-100 text-yellow-800";
  if (grade === "D") return "bg-orange-100 text-orange-800";
  if (grade === "E" || grade === "F") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

function subjectName(s: Subject) {
  return s.subject_name || s.name || s.code || "Subject";
}

function assessmentKey(a: Assessment) {
  const label = a.label || a.assessment || a.exam_name || "Assessment";
  const component = a.component || "OTHER";
  return `${a.exam_id ?? ""}|${label}|${component}`.toLowerCase();
}

function getColumns(reports: Report[]): Assessment[] {
  const result: Assessment[] = [];
  const seen = new Set<string>();

  // Keep the class-wise sheet WPS-compatible even for legacy templates that
  // were saved before assessment configuration was added.
  const defaults: Assessment[] = [
    { id: "ut1_written", label: "Unit Test 1", assessment: "Unit Test 1", component: "WRITTEN", enabled: true, display_order: 10 },
    { id: "ut1_oral", label: "Unit Test 1", assessment: "Unit Test 1", component: "ORAL", enabled: true, display_order: 11 },
    { id: "ut2_written", label: "Unit Test 2", assessment: "Unit Test 2", component: "WRITTEN", enabled: true, display_order: 20 },
    { id: "ut2_oral", label: "Unit Test 2", assessment: "Unit Test 2", component: "ORAL", enabled: true, display_order: 21 },
    { id: "ut3_written", label: "Unit Test 3", assessment: "Unit Test 3", component: "WRITTEN", enabled: true, display_order: 30 },
    { id: "ut3_oral", label: "Unit Test 3", assessment: "Unit Test 3", component: "ORAL", enabled: true, display_order: 31 },
    { id: "half_yearly_written", label: "Half Yearly", assessment: "Half Yearly", component: "WRITTEN", enabled: true, display_order: 40 },
    { id: "half_yearly_oral", label: "Half Yearly", assessment: "Half Yearly", component: "ORAL", enabled: true, display_order: 41 },
    { id: "yearly_written", label: "Yearly / Final", assessment: "Yearly / Final", component: "WRITTEN", enabled: true, display_order: 50 },
    { id: "yearly_oral", label: "Yearly / Final", assessment: "Yearly / Final", component: "ORAL", enabled: true, display_order: 51 },
  ];

  const add = (a: Assessment) => {
    if (a.enabled === false) return;
    const key = assessmentKey(a);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(a);
  };

  const configured = reports[0]?.template?.settings?.assessments || [];
  (configured.length ? configured : defaults)
    .slice()
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
    .forEach(add);

  reports.forEach((r) =>
    (r.academic_subjects || []).forEach((s) =>
      (s.assessments || []).forEach(add)
    )
  );

  return result;
}

function findAssessment(subject: Subject | undefined, column: Assessment) {
  if (!subject) return undefined;

  return (subject.assessments || []).find(
    (a) => assessmentKey(a) === assessmentKey(column)
  );
}

function findSubject(report: Report, name: string) {
  return (report.academic_subjects || []).find(
    (s) => subjectName(s).trim().toLowerCase() === name.trim().toLowerCase()
  );
}

function getSubjects(reports: Report[]) {
  const result: string[] = [];
  const seen = new Set<string>();

  reports.forEach((r) =>
    (r.academic_subjects || []).forEach((s) => {
      const name = subjectName(s);
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(name);
      }
    })
  );

  return result;
}

function totals(report: Report) {
  let obtained = 0;
  let maximum = 0;
  let complete = true;

  (report.academic_subjects || []).forEach((s) => {
    const max = num(s.max_marks);
    const got = num(s.marks_obtained);

    if (max !== null) maximum += max;
    if (got !== null) obtained += got;
    else complete = false;

    if (s.calculation_complete === false) complete = false;
  });

  return {
    obtained,
    maximum,
    complete,
    percentage: maximum > 0 && complete ? (obtained / maximum) * 100 : null,
  };
}

function fallbackGrade(p: number | null) {
  if (p === null) return "Pending";
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 70) return "B+";
  if (p >= 60) return "B";
  if (p >= 50) return "C";
  if (p >= 40) return "D";
  return "F";
}

export default function ClassWiseReportCardRenderer({
  reports,
  title = "STUDENT PROGRESS REPORT",
  schoolName,
  schoolAddress,
  examName,
  showAssessments = true,
  showResult = true,
}: Props) {
  if (!reports.length) {
    return (
      <div className="border border-black bg-white p-8 text-center text-sm">
        No student reports available.
      </div>
    );
  }

  const settings = reports[0]?.template?.settings;
  const school = schoolName || settings?.school?.name || "WISDOM PUBLIC SCHOOL";
  const address = schoolAddress || settings?.school?.address || "DOOMARA, NAWALGARH";
  const exam = examName || reports[0]?.exam?.name || "";
  const columns = showAssessments ? getColumns(reports) : [];
  const subjects = getSubjects(reports);
  const assessmentMode = columns.length > 0;

  return (
    <section className="w-full bg-white p-3 text-black print:p-2">
      <header className="border-b-2 border-black pb-3 text-center">
        <div className="text-[20px] font-bold tracking-wide">{school}</div>
        {address && <div className="text-[11px] font-medium">{address}</div>}
        <div className="mt-2 text-[15px] font-bold uppercase">{title}</div>
        {exam && <div className="text-[11px] font-semibold">Examination: {exam}</div>}
      </header>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border border-black px-2 py-2 text-[9px]">S.No.</th>
              <th rowSpan={2} className="min-w-[150px] border border-black px-2 py-2 text-left text-[9px]">Student Name</th>
              <th rowSpan={2} className="min-w-[120px] border border-black px-2 py-2 text-left text-[9px]">Father&apos;s Name</th>
              <th rowSpan={2} className="border border-black px-2 py-2 text-[9px]">Roll No.</th>

              {subjects.map((name) => (
                <th
                  key={name}
                  colSpan={assessmentMode ? columns.length + 3 : 3}
                  className="border border-black px-2 py-2 text-center text-[9px]"
                >
                  {name}
                </th>
              ))}

              <th rowSpan={2} className="border border-black px-2 py-2 text-[9px]">Total</th>
              <th rowSpan={2} className="border border-black px-2 py-2 text-[9px]">Max</th>
              <th rowSpan={2} className="border border-black px-2 py-2 text-[9px]">%</th>
              <th rowSpan={2} className="border border-black px-2 py-2 text-[9px]">Grade</th>

              {showResult && (
                <>
                  <th rowSpan={2} className="border border-black px-2 py-2 text-[9px]">Result</th>
                  <th rowSpan={2} className="border border-black px-2 py-2 text-[9px]">Rank</th>
                </>
              )}
            </tr>

            <tr className="bg-gray-50">
              {subjects.map((name) => (
                <React.Fragment key={`head-${name}`}>
                  {assessmentMode &&
                    columns.map((column) => (
                      <th key={`${name}-${assessmentKey(column)}`} className="border border-black px-1 py-1 text-[7px]">
                        <div>{column.label || column.assessment || column.exam_name || "Assessment"}</div>
                        {column.component && column.component !== "OTHER" && (
                          <div className="text-[6px] uppercase text-gray-600">{column.component}</div>
                        )}
                      </th>
                    ))}
                  <th className="border border-black px-1 py-1 text-[7px]">Obt.</th>
                  <th className="border border-black px-1 py-1 text-[7px]">Max.</th>
                  <th className="border border-black px-1 py-1 text-[7px]">Grade</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {reports.map((report, index) => {
              const t = totals(report);
              const result = report.result;
              const percentage = num(result?.percentage) ?? t.percentage;
              const grade = result?.grade || (t.complete ? fallbackGrade(percentage) : "Pending");
              const isPending = !t.complete || result?.calculation_complete === false;

              return (
                <tr key={text(report.student?.id) || `student-${index}`} className="align-middle">
                  <td className="border border-black px-2 py-2 text-center text-[9px]">{index + 1}</td>

                  <td className="border border-black px-2 py-2 text-left text-[9px] font-semibold">
                    {studentName(report.student)}
                    {report.student?.admission_number && (
                      <div className="text-[7px] font-normal text-gray-500">
                        Adm. No: {report.student.admission_number}
                      </div>
                    )}
                  </td>

                  <td className="border border-black px-2 py-2 text-left text-[9px]">
                    {report.student?.father_name || report.student?.fatherName || "-"}
                  </td>

                  <td className="border border-black px-2 py-2 text-center text-[9px]">
                    {text(report.student?.roll_number || "-")}
                  </td>

                  {subjects.map((name) => {
                    const subject = findSubject(report, name);

                    return (
                      <React.Fragment key={`${index}-${name}`}>
                        {assessmentMode &&
                          columns.map((column) => {
                            const a = findAssessment(subject, column);
                            return (
                              <td
                                key={`${index}-${name}-${assessmentKey(column)}`}
                                className="border border-black px-1 py-1 text-center text-[9px]"
                              >
                                {a?.marks_obtained !== null && a?.marks_obtained !== undefined
                                  ? fmt(a.marks_obtained)
                                  : "Pending"}
                                {a?.max_marks !== null && a?.max_marks !== undefined && (
                                  <div className="text-[6px] text-gray-500">/{fmt(a.max_marks)}</div>
                                )}
                              </td>
                            );
                          })}

                        <td className="border border-black px-1 py-1 text-center text-[9px] font-semibold">
                          {subject?.calculation_complete === false
                            ? "Pending"
                            : fmt(subject?.marks_obtained)}
                        </td>

                        <td className="border border-black px-1 py-1 text-center text-[9px]">
                          {fmt(subject?.max_marks)}
                        </td>

                        <td className="border border-black px-1 py-1 text-center text-[9px]">
                          {subject?.calculation_complete === false || !subject?.grade ? (
                            "Pending"
                          ) : (
                            <span className={`inline-flex rounded px-1 py-0.5 text-[8px] font-bold ${gradeClass(subject.grade)}`}>
                              {subject.grade}
                            </span>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  <td className="border border-black px-2 py-2 text-center text-[9px] font-bold">
                    {isPending ? "Pending" : fmt(result?.obtained_marks ?? t.obtained)}
                  </td>

                  <td className="border border-black px-2 py-2 text-center text-[9px] font-bold">
                    {fmt(result?.max_marks ?? t.maximum)}
                  </td>

                  <td className="border border-black px-2 py-2 text-center text-[9px] font-bold">
                    {isPending || percentage === null ? "Pending" : `${fmt(percentage)}%`}
                  </td>

                  <td className="border border-black px-2 py-2 text-center text-[9px] font-bold">
                    {grade === "Pending" ? (
                      "Pending"
                    ) : (
                      <span className={`inline-flex min-w-[28px] justify-center rounded px-1 py-0.5 text-[8px] ${gradeClass(grade)}`}>
                        {grade}
                      </span>
                    )}
                  </td>

                  {showResult && (
                    <>
                      <td className="border border-black px-2 py-2 text-center text-[9px] font-bold">
                        {isPending ? "Pending" : result?.result || (result?.is_pass ? "PASS" : "FAIL")}
                      </td>
                      <td className="border border-black px-2 py-2 text-center text-[9px] font-bold">
                        {result?.rank ?? "-"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="mt-3 border-t border-black pt-2 text-[8px]">
        <span className="font-bold">Assessment Components:</span>{" "}
        {columns.length
          ? columns
              .map((c) => `${c.label || c.assessment || c.exam_name || "Assessment"}${c.component && c.component !== "OTHER" ? ` (${c.component})` : ""}`)
              .join(" • ")
          : "Configured exam assessments"}
      </footer>
    </section>
  );
}
