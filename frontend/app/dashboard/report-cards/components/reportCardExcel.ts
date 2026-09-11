export type ReportCardExcelAssessment = {
  label?: string | null;
  assessment?: string | null;
  component?: string | null;
  max_marks?: number | null;
  marks_obtained?: number | null;
};

export type ReportCardExcelSubject = {
  subject_id?: number;
  subject_name?: string | null;
  subject_code?: string | null;
  max_marks?: number | null;
  pass_marks?: number | null;
  marks_obtained?: number | null;
  percentage?: number | null;
  grade?: string | null;
  assessments?: ReportCardExcelAssessment[];
};

export type ReportCardExcelReport = {
  student?: {
    id?: number;
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    admission_number?: string | null;
    admission_no?: string | null;
    father_name?: string | null;
    class_name?: string | null;
    section?: string | null;
    roll_no?: string | number | null;
    roll_number?: string | number | null;
  } | null;

  exam?: {
    name?: string | null;
    academic_year?: string | null;
    term?: string | null;
  } | null;

  academic_session?: {
    name?: string | null;
    session_name?: string | null;
  } | null;

  academic_subjects?: ReportCardExcelSubject[];

  result?: {
    total_marks?: number | null;
    max_marks?: number | null;
    percentage?: number | null;
    grade?: string | null;
    division?: string | null;
    rank?: number | null;
    is_pass?: boolean | null;
    calculation_complete?: boolean;
  } | null;
};

function valueOrBlank(
  value: unknown
): string | number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  return value as string | number;
}

function studentName(
  student: ReportCardExcelReport["student"]
) {
  if (!student) {
    return "";
  }

  if (student.name) {
    return student.name;
  }

  return [
    student.first_name,
    student.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function assessmentColumnKey(
  assessment: ReportCardExcelAssessment
) {
  return [
    assessment.label ||
      assessment.assessment ||
      "Assessment",
    assessment.component || "",
  ]
    .join(" ")
    .trim();
}

function collectAssessmentColumns(
  reports: ReportCardExcelReport[]
) {
  const columns: string[] = [];

  const seen = new Set<string>();

  for (const report of reports) {
    for (const subject of
      report.academic_subjects || []) {
      for (const assessment of
        subject.assessments || []) {
        const key =
          assessmentColumnKey(
            assessment
          );

        if (!key || seen.has(key)) {
          continue;
        }

        seen.add(key);
        columns.push(key);
      }
    }
  }

  return columns;
}

function findAssessmentMark(
  subject: ReportCardExcelSubject,
  column: string
) {
  const assessment =
    (subject.assessments || []).find(
      (item) =>
        assessmentColumnKey(item) ===
        column
    );

  return assessment
    ? valueOrBlank(
        assessment.marks_obtained
      )
    : "";
}

function escapeCsvCell(
  value: unknown
) {
  const text =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  if (
    /[",\n\r]/.test(text)
  ) {
    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  }

  return text;
}

function buildCsv(
  rows: Array<
    Array<string | number>
  >
) {
  return rows
    .map((row) =>
      row
        .map(escapeCsvCell)
        .join(",")
    )
    .join("\r\n");
}

function downloadCsv(
  csv: string,
  filename: string
) {
  const blob = new Blob(
    ["\ufeff", csv],
    {
      type:
        "text/csv;charset=utf-8;",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(
    anchor
  );

  anchor.click();

  document.body.removeChild(
    anchor
  );

  URL.revokeObjectURL(url);
}

/**
 * Export a student-wise detailed
 * report-card dataset.
 *
 * One row = one student + one subject.
 *
 * Assessment columns are generated
 * dynamically from actual backend data,
 * so UT-1 Written, UT-1 Oral, UT-2,
 * Half Yearly, Yearly, etc. are not
 * hardcoded.
 */
export function exportReportCardsToCsv(
  reports: ReportCardExcelReport[],
  filename = "report-cards.csv"
) {
  if (!reports.length) {
    return;
  }

  const assessmentColumns =
    collectAssessmentColumns(
      reports
    );

  const rows: Array<
    Array<string | number>
  > = [];

  const header = [
    "Sr. No.",
    "Student Name",
    "Admission No.",
    "Father's Name",
    "Class",
    "Section",
    "Roll No.",
    "Exam",
    "Academic Session",
    "Subject",
    ...assessmentColumns,
    "Max Marks",
    "Pass Marks",
    "Obtained Marks",
    "Percentage",
    "Grade",
  ];

  rows.push(header);

  let serial = 1;

  for (const report of reports) {
    const student =
      report.student || {};

    const subjects =
      report.academic_subjects ||
      [];

    for (
      const subject of subjects
    ) {
      rows.push([
        serial++,
        studentName(student),
        valueOrBlank(
          student.admission_number ||
            student.admission_no
        ),
        valueOrBlank(
          student.father_name
        ),
        valueOrBlank(
          student.class_name
        ),
        valueOrBlank(
          student.section
        ),
        valueOrBlank(
          student.roll_no ??
            student.roll_number
        ),
        valueOrBlank(
          report.exam?.name
        ),
        valueOrBlank(
          report.academic_session
            ?.name ||
            report.academic_session
              ?.session_name ||
            report.exam
              ?.academic_year
        ),
        valueOrBlank(
          subject.subject_name
        ),
        ...assessmentColumns.map(
          (column) =>
            findAssessmentMark(
              subject,
              column
            )
        ),
        valueOrBlank(
          subject.max_marks
        ),
        valueOrBlank(
          subject.pass_marks
        ),
        valueOrBlank(
          subject.marks_obtained
        ),
        subject.percentage == null
          ? ""
          : subject.percentage,
        valueOrBlank(
          subject.grade
        ),
      ]);
    }
  }

  downloadCsv(
    buildCsv(rows),
    filename
  );
}

/**
 * WPS-style class-wise summary.
 *
 * One row = one student.
 *
 * Subjects become columns and each
 * cell contains the subject obtained
 * marks. Totals / percentage / grade
 * remain at the end.
 */
export function exportClassWiseReportCardsToCsv(
  reports: ReportCardExcelReport[],
  filename = "class-wise-report-cards.csv"
) {
  if (!reports.length) {
    return;
  }

  const subjectNames: string[] =
    [];

  const seenSubjects =
    new Set<string>();

  for (const report of reports) {
    for (const subject of
      report.academic_subjects || []) {
      const name =
        subject.subject_name ||
        `Subject ${
          subject.subject_id || ""
        }`;

      if (
        !seenSubjects.has(name)
      ) {
        seenSubjects.add(name);
        subjectNames.push(name);
      }
    }
  }

  const rows: Array<
    Array<string | number>
  > = [];

  rows.push([
    "Sr. No.",
    "Student Name",
    "Father's Name",
    "Admission No.",
    "Class",
    "Section",
    "Roll No.",
    ...subjectNames,
    "Total",
    "Maximum",
    "Marks (%)",
    "Grade",
    "Division",
    "Result",
    "Rank",
  ]);

  reports.forEach(
    (report, index) => {
      const student =
        report.student || {};

      const subjectMap =
        new Map<
          string,
          ReportCardExcelSubject
        >();

      for (const subject of
        report.academic_subjects ||
        []) {
        const name =
          subject.subject_name ||
          `Subject ${
            subject.subject_id || ""
          }`;

        subjectMap.set(
          name,
          subject
        );
      }

      const result =
        report.result || {};

      rows.push([
        index + 1,
        studentName(student),
        valueOrBlank(
          student.father_name
        ),
        valueOrBlank(
          student.admission_number ||
            student.admission_no
        ),
        valueOrBlank(
          student.class_name
        ),
        valueOrBlank(
          student.section
        ),
        valueOrBlank(
          student.roll_no ??
            student.roll_number
        ),

        ...subjectNames.map(
          (subjectName) =>
            valueOrBlank(
              subjectMap.get(
                subjectName
              )?.marks_obtained
            )
        ),

        valueOrBlank(
          result.total_marks
        ),
        valueOrBlank(
          result.max_marks
        ),
        result.percentage == null
          ? ""
          : result.percentage,
        valueOrBlank(
          result.grade
        ),
        valueOrBlank(
          result.division
        ),
        result.is_pass == null
          ? ""
          : result.is_pass
            ? "PASS"
            : "FAIL",
        valueOrBlank(
          result.rank
        ),
      ]);
    }
  );

  downloadCsv(
    buildCsv(rows),
    filename
  );
}