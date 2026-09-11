"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";

type Student = {
  id: number;
  admission_number?: string | null;
  admission_no?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
  gender?: string | null;
  category?: string | null;
  class_id?: number | null;
  class_name?: string | null;
  section?: string | null;
  roll_no?: string | number | null;
};

type Exam = {
  id: number;
  name?: string | null;
  exam_type?: string | null;
  academic_year?: string | null;
  term?: string | null;
  status?: string | null;
};

type TemplateElement = {
  id?: string;
  type: string;
  label?: string;
  text?: string;
  value?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  align?: string;
  visible?: boolean;
  style?: {
    background?: string;
    color?: string;
    borderColor?: string;
    borderWidth?: number;
    radius?: number;
    padding?: number;
  };
};

type TemplateSettings = {
  school?: {
    name?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  };
  report?: {
    title?: string;
    subtitle?: string;
    resultDateLabel?: string;
    showResultDate?: boolean;
  };
  academic?: {
    enabled?: boolean;
    title?: string;
    showMaxMarks?: boolean;
    showPassMarks?: boolean;
    showObtained?: boolean;
    showGrade?: boolean;
    showRemark?: boolean;
    columns?: string[];
  };
  co_scholastic?: {
    enabled?: boolean;
    title?: string;
    showGrade?: boolean;
    showRemark?: boolean;
    subjects?: Array<{
      id?: string;
      name?: string;
      gradeBased?: boolean;
      active?: boolean;
    }>;
  };
  attendance?: {
    enabled?: boolean;
    showWorkingDays?: boolean;
    showPresentDays?: boolean;
    showPercentage?: boolean;
  };
  remarks?: {
    enabled?: boolean;
    classTeacher?: boolean;
    principal?: boolean;
  };
  signatures?: {
    enabled?: boolean;
    classTeacher?: boolean;
    principal?: boolean;
    parent?: boolean;
  };
  theme?: {
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
};

type Template = {
  id: number;
  name: string;
  description?: string | null;
  class_id?: number | null;
  academic_session_id?: number | null;
  exam_id?: number | null;
  page_size?: string;
  orientation?: string;
  status?: string;
  is_default?: boolean;
  elements?: TemplateElement[];
  settings?: TemplateSettings;
  created_at?: string;
  updated_at?: string;
};

type AcademicSubject = {
  subject_id: number;
  subject_name: string;
  subject_code?: string | null;
  max_marks: number;
  pass_marks: number;
  marks_obtained?: number | null;
  percentage?: number | null;
  grade?: string | null;
  remark?: string | null;
  is_optional?: boolean;
  include_in_result?: boolean;
  is_pass?: boolean | null;
};

type CoScholasticItem = {
  name: string;
  value?: string | null;
  grade?: string | null;
  remark?: string | null;
};

type ReportCard = {
  template?: Template | null;

  student: Student;

  exam?: {
    id?: number;
    name?: string;
    exam_type?: string;
    academic_year?: string;
    term?: string;
  } | null;

  academic_session?: {
    id?: number;
    name?: string;
    session_name?: string;
  } | null;

  academic_subjects: AcademicSubject[];

  co_scholastic: CoScholasticItem[];

  result: {
    total_marks?: number | null;
    max_marks?: number | null;
    percentage?: number | null;
    grade?: string | null;
    rank?: number | null;
    division?: string | null;
    is_pass?: boolean | null;
  };

  attendance: {
    total_days?: number;
    present_days?: number;
    absent_days?: number;
    percentage?: number | null;
  };

  class_teacher_remark?: string | null;
  principal_remark?: string | null;
};

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem("access_token") || "";
}

async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }

    throw new Error(
      "Session expired. Please login again."
    );
  }

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" && data?.detail
        ? data.detail
        : `Request failed with status ${response.status}`;

    throw new Error(detail);
  }

  return data;
}

function normalizeList<T>(data: any): T[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function studentDisplayName(student: Student) {
  if (student.name) {
    return student.name;
  }

  const fullName = [
    student.first_name,
    student.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || "Unnamed Student";
}

function formatNumber(value?: number | null) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  const number = Number(value);

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(2);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function gradeClass(grade?: string | null) {
  if (!grade) {
    return "text-slate-700";
  }

  const value = grade.toUpperCase();

  if (
    ["A+", "A", "A1"].includes(value)
  ) {
    return "text-emerald-700";
  }

  if (
    ["B+", "B", "B1"].includes(value)
  ) {
    return "text-blue-700";
  }

  if (
    ["C+", "C"].includes(value)
  ) {
    return "text-amber-700";
  }

  if (
    ["D", "E", "F"].includes(value)
  ) {
    return "text-red-700";
  }

  return "text-slate-700";
}

function escapeRegExp(value: string) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return new Date().toLocaleDateString("en-IN");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN");
}

function placeholderValues(
  report: ReportCard
): Record<string, string> {
  const student = report.student || {};
  const result = report.result || {};
  const attendance = report.attendance || {};

  return {
    "{{student_name}}":
      studentDisplayName(student),

    "{{father_name}}":
      student.father_name || "—",

    "{{mother_name}}":
      student.mother_name || "—",

    "{{class_name}}":
      student.class_name || "—",

    "{{section}}":
      student.section || "—",

    "{{roll_no}}":
      String(student.roll_no ?? "—"),

    "{{admission_no}}":
      student.admission_number ||
      student.admission_no ||
      "—",

    "{{dob}}":
      student.date_of_birth ||
      student.dob ||
      "—",

    "{{gender}}":
      student.gender || "—",

    "{{category}}":
      student.category || "—",

    "{{academic_session}}":
      report.academic_session?.name ||
      report.academic_session?.session_name ||
      report.exam?.academic_year ||
      "—",

    "{{exam_name}}":
      report.exam?.name ||
      "—",

    "{{total_marks}}":
      formatNumber(result.total_marks),

    "{{max_marks}}":
      formatNumber(result.max_marks),

    "{{percentage}}":
      result.percentage == null
        ? "—"
        : `${formatNumber(result.percentage)}%`,

    "{{grade}}":
      result.grade || "—",

    "{{division}}":
      result.division || "—",

    "{{result}}":
      result.is_pass == null
        ? "—"
        : result.is_pass
          ? "PASS"
          : "FAIL",

    "{{rank}}":
      result.rank == null
        ? "—"
        : String(result.rank),

    "{{attendance_percentage}}":
      attendance.percentage == null
        ? "—"
        : `${formatNumber(attendance.percentage)}%`,

    "{{class_teacher_remark}}":
      report.class_teacher_remark || "—",

    "{{principal_remark}}":
      report.principal_remark || "—",

    "{{school_name}}":
      report.template?.settings?.school?.name ||
      "EduOS School",
  };
}

function resolvePlaceholders(
  text: string,
  report: ReportCard
) {
  let result = text || "";

  const values = placeholderValues(report);

  Object.entries(values).forEach(
    ([key, value]) => {
      result = result.replace(
        new RegExp(
          escapeRegExp(key),
          "g"
        ),
        value
      );
    }
  );

  return result;
}

function themeFor(
  template?: Template | null
) {
  return {
    primary:
      template?.settings?.theme?.primary ||
      "#1647b8",

    secondary:
      template?.settings?.theme?.secondary ||
      "#0d348d",

    accent:
      template?.settings?.theme?.accent ||
      "#315fd0",

    gold:
      template?.settings?.theme?.gold ||
      "#caa54d",

    headerBg:
      template?.settings?.theme?.headerBg ||
      "#f1f5ff",

    tableHeader:
      template?.settings?.theme?.tableHeader ||
      "#2451c5",

    softBg:
      template?.settings?.theme?.softBg ||
      "#eef3ff",

    border:
      template?.settings?.theme?.border ||
      "#d7ddeb",

    text:
      template?.settings?.theme?.text ||
      "#243044",

    muted:
      template?.settings?.theme?.muted ||
      "#667085",

    success:
      template?.settings?.theme?.success ||
      "#16a34a",

    fontFamily:
      template?.settings?.theme?.fontFamily ||
      "Arial",

    borderRadius:
      template?.settings?.theme?.borderRadius ||
      8,
  };
}

export default function ReportCardsPage() {
  const router = useRouter();

  const [students, setStudents] =
    useState<Student[]>([]);

  const [templates, setTemplates] =
    useState<Template[]>([]);

  const [selectedStudentId, setSelectedStudentId] =
    useState("");

  const [selectedTemplateId, setSelectedTemplateId] =
    useState("");

  const [selectedExamId, setSelectedExamId] =
    useState("");

  const [classFilter, setClassFilter] =
    useState("");

  const [sectionFilter, setSectionFilter] =
    useState("");

  const [selectedBulkIds, setSelectedBulkIds] =
    useState<number[]>([]);

  const [bulkReports, setBulkReports] =
    useState<ReportCard[]>([]);

  const [loadingBulk, setLoadingBulk] =
    useState(false);

  const [bulkError, setBulkError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [report, setReport] =
    useState<ReportCard | null>(null);

  const [exams, setExams] =
    useState<Exam[]>([]);

  const [loadingExams, setLoadingExams] =
    useState(false);

  const [loadingStudents, setLoadingStudents] =
    useState(true);

  const [loadingTemplates, setLoadingTemplates] =
    useState(true);

  const [loadingReport, setLoadingReport] =
    useState(false);

  const [error, setError] =
    useState("");

  const [templateError, setTemplateError] =
    useState("");

  const loadExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const data = await apiFetch("/exams/");
      setExams(normalizeList<Exam>(data));
    } catch {
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  }, []);

  const loadStudents = useCallback(
    async () => {
      setLoadingStudents(true);

      try {
        const data =
          await apiFetch("/students/");

        const list =
          normalizeList<Student>(data);

        setStudents(list);

        if (
          !selectedStudentId &&
          list.length
        ) {
          setSelectedStudentId(
            String(list[0].id)
          );
        }
      } catch (err: any) {
        setError(
          err?.message ||
            "Unable to load students."
        );
      } finally {
        setLoadingStudents(false);
      }
    },
    [selectedStudentId]
  );

  const loadTemplates = useCallback(
    async () => {
      setLoadingTemplates(true);
      setTemplateError("");

      try {
        const data =
          await apiFetch(
            "/report-card-templates/"
          );

        const list =
          normalizeList<Template>(data);

        const sorted = [...list].sort(
          (a, b) => {
            if (
              Boolean(a.is_default) !==
              Boolean(b.is_default)
            ) {
              return a.is_default
                ? -1
                : 1;
            }

            return (
              Number(b.id) -
              Number(a.id)
            );
          }
        );

        setTemplates(sorted);

        if (
          selectedTemplateId &&
          !sorted.some(
            (item) =>
              String(item.id) ===
              selectedTemplateId
          )
        ) {
          setSelectedTemplateId("");
        }
      } catch (err: any) {
        setTemplateError(
          err?.message ||
            "Unable to load saved templates."
        );

        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    },
    [selectedTemplateId]
  );

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((student) => {
      if (student.class_id != null) {
        map.set(
          String(student.class_id),
          student.class_name || `Class ${student.class_id}`
        );
      }
    });
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], undefined, { numeric: true })
    );
  }, [students]);

  const sectionOptions = useMemo(() => {
    const values = new Set<string>();
    students.forEach((student) => {
      if (!classFilter || String(student.class_id ?? "") === classFilter) {
        if (student.section) values.add(String(student.section));
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [students, classFilter]);

  const filteredStudents = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return students.filter((student) => {
      if (classFilter && String(student.class_id ?? "") !== classFilter) {
        return false;
      }

      if (sectionFilter && String(student.section ?? "") !== sectionFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        studentDisplayName(student),
        student.admission_number,
        student.admission_no,
        student.roll_no,
        student.class_name,
        student.section,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [students, search, classFilter, sectionFilter]);

  const selectedStudent = useMemo(
    () =>
      students.find(
        (student) =>
          String(student.id) ===
          selectedStudentId
      ) || null,
    [
      students,
      selectedStudentId,
    ]
  );

  /*
   * IMPORTANT:
   * Do NOT hide global templates when
   * student class changes.
   *
   * A template with class_id = null
   * is a global template and must remain
   * available.
   */
  const availableTemplates = useMemo(
    () => {
      if (!selectedStudent?.class_id) {
        return templates;
      }

      const classSpecific =
        templates.filter(
          (template) =>
            template.class_id ===
            selectedStudent.class_id
        );

      const global =
        templates.filter(
          (template) =>
            template.class_id == null
        );

      const other =
        templates.filter(
          (template) =>
            template.class_id != null &&
            template.class_id !==
              selectedStudent.class_id
        );

      const unique = new Map<
        number,
        Template
      >();

      [
        ...classSpecific,
        ...global,
        ...other,
      ].forEach((template) => {
        unique.set(
          template.id,
          template
        );
      });

      return Array.from(
        unique.values()
      );
    },
    [
      selectedStudent,
      templates,
    ]
  );

  const selectedTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          String(template.id) ===
          selectedTemplateId
      ) || null,
    [
      templates,
      selectedTemplateId,
    ]
  );

  async function loadReportCard() {
    if (!selectedStudentId) {
      setError(
        "Please select a student."
      );
      return;
    }

    setLoadingReport(true);
    setError("");

    try {
      const params =
        new URLSearchParams();

      if (selectedTemplateId) {
        params.set(
          "template_id",
          selectedTemplateId
        );
      }

      if (selectedExamId) {
        params.set("exam_id", selectedExamId);
      }

      const query =
        params.toString();

      const data =
        await apiFetch(
          `/report-cards/student/${selectedStudentId}${
            query
              ? `?${query}`
              : ""
          }`
        );

      setReport(data);

      /*
       * Backend may select a default
       * template when no explicit template
       * was sent. Reflect that selection
       * in the UI.
       */
      if (
        !selectedTemplateId &&
        data?.template?.id
      ) {
        setSelectedTemplateId(
          String(data.template.id)
        );
      }
    } catch (err: any) {
      setReport(null);

      setError(
        err?.message ||
          "Unable to generate report card."
      );
    } finally {
      setLoadingReport(false);
    }
  }

  const toggleBulkStudent = (studentId: number) => {
    setSelectedBulkIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedBulkIds(filteredStudents.map((student) => student.id));
  };

  const clearBulkSelection = () => {
    setSelectedBulkIds([]);
  };

  async function generateBulkReports() {
    if (!selectedBulkIds.length) {
      setBulkError("Kam se kam 1 student select karo.");
      return;
    }

    setLoadingBulk(true);
    setBulkError("");
    setBulkReports([]);

    try {
      const params = new URLSearchParams();
      if (classFilter) params.set("class_id", classFilter);
      if (sectionFilter) params.set("section", sectionFilter);
      if (selectedExamId) params.set("exam_id", selectedExamId);
      if (selectedTemplateId) params.set("template_id", selectedTemplateId);
      params.set("student_ids", selectedBulkIds.join(","));

      const data = await apiFetch(`/report-cards/bulk?${params.toString()}`);
      setBulkReports(Array.isArray(data?.reports) ? data.reports : []);
    } catch (err: any) {
      setBulkError(err?.message || "Bulk report generate nahi ho paya.");
    } finally {
      setLoadingBulk(false);
    }
  }

  function printBulkReports() {
    if (!bulkReports.length) return;
    window.print();
  }

  function printReport() {
    if (!report) {
      return;
    }

    window.print();
  }

  function editSelectedTemplate() {
    const id =
      selectedTemplateId ||
      report?.template?.id;

    if (!id) {
      return;
    }

    router.push(
      `/dashboard/report-cards/templates?id=${id}`
    );
  }

  function editTemplate(
    templateId: number
  ) {
    router.push(
      `/dashboard/report-cards/templates?id=${templateId}`
    );
  }

  return (
    <div className={`min-h-screen bg-slate-100 text-slate-900 ${bulkReports.length ? "bulk-print-active" : ""}`}>
      <div className="mx-auto max-w-[1500px] p-4 md:p-6">

        <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between print:hidden">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                RC
              </div>

              <div>
                <h1 className="text-2xl font-bold">
                  Report Cards
                </h1>

                <p className="text-sm text-slate-500">
                  Student-wise marksheet,
                  result, attendance and
                  co-scholastic report
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                router.push(
                  "/dashboard/report-cards/templates"
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              Manage Templates
            </button>

            <button
              onClick={() =>
                router.push(
                  "/dashboard/report-cards/templates"
                )
              }
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + New Template
            </button>

            <button
              onClick={printReport}
              disabled={!report}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Print / PDF
            </button>

            <button
              onClick={printBulkReports}
              disabled={!bulkReports.length}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Bulk Print / PDF
            </button>
          </div>
        </header>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold">
                Saved Templates
              </h2>

              <p className="text-xs text-slate-500">
                Templates saved from the
                marksheet builder are available
                here.
              </p>
            </div>

            <button
              onClick={loadTemplates}
              disabled={loadingTemplates}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingTemplates
                ? "Refreshing..."
                : "Refresh Templates"}
            </button>
          </div>

          {templateError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {templateError}
            </div>
          ) : loadingTemplates ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Loading saved templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
              <div className="text-sm font-semibold">
                No saved templates found
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Create a template from
                Manage Templates.
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.map(
                (template) => {
                  const active =
                    String(template.id) ===
                    selectedTemplateId;

                  return (
                    <div
                      key={template.id}
                      className={`rounded-xl border p-4 transition ${
                        active
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() => {
                            setSelectedTemplateId(
                              String(template.id)
                            );
                            setReport(null);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-sm font-bold">
                            {template.name}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {template.is_default && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                DEFAULT
                              </span>
                            )}

                            {template.class_id == null && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                GLOBAL
                              </span>
                            )}

                            {template.status && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                {template.status}
                              </span>
                            )}
                          </div>
                        </button>

                        <button
                          onClick={() =>
                            editTemplate(
                              template.id
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      </div>

                      <div className="mt-3 text-xs text-slate-500">
                        {template.elements?.length ||
                          0}{" "}
                        elements
                      </div>

                      <button
                        onClick={() => {
                          setSelectedTemplateId(
                            String(template.id)
                          );
                          setReport(null);
                        }}
                        className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-bold ${
                          active
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {active
                          ? "Selected Template"
                          : "Use This Template"}
                      </button>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold">Class-wise / Bulk Report Cards</h2>
              <p className="text-xs text-slate-500">
                WPS-style selection: class, section, exam aur saved template ke saath selected students ka same A4 report card generate karo.
              </p>
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              Selected: {selectedBulkIds.length}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={classFilter}
              onChange={(event) => {
                setClassFilter(event.target.value);
                setSectionFilter("");
                setSelectedBulkIds([]);
                setBulkReports([]);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">All Classes</option>
              {classOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={(event) => {
                setSectionFilter(event.target.value);
                setSelectedBulkIds([]);
                setBulkReports([]);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">All Sections</option>
              {sectionOptions.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>

            <select
              value={selectedExamId}
              onChange={(event) => {
                setSelectedExamId(event.target.value);
                setReport(null);
                setBulkReports([]);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">{loadingExams ? "Loading Exams..." : "Select Exam"}</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.name || `Exam ${exam.id}`}</option>
              ))}
            </select>

            <select
              value={selectedTemplateId}
              onChange={(event) => {
                setSelectedTemplateId(event.target.value);
                setReport(null);
                setBulkReports([]);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Use Default Template</option>
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={selectAllFiltered} disabled={!filteredStudents.length} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Select All</button>
            <button onClick={clearBulkSelection} disabled={!selectedBulkIds.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Deselect All</button>
            <button onClick={generateBulkReports} disabled={!selectedBulkIds.length || loadingBulk} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{loadingBulk ? "Generating..." : "Generate Selected"}</button>
            <button onClick={printBulkReports} disabled={!bulkReports.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Download / Print PDF</button>
          </div>

          {bulkError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{bulkError}</div>}

          {bulkReports.length > 0 && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {bulkReports.length} report cards ready — print dialog se PDF save kar sakte ho.
            </div>
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">

          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm print:hidden">
            <div className="border-b border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">
                  Students
                </h2>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {students.length}
                </span>
              </div>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search student, admission no..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </div>

            <div className="max-h-[620px] overflow-y-auto p-2">
              {loadingStudents ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  Loading students...
                </div>
              ) : filteredStudents.length ===
                0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No students found.
                </div>
              ) : (
                filteredStudents.map(
                  (student) => {
                    const active =
                      String(student.id) ===
                      selectedStudentId;

                    return (
                      <button
                        key={student.id}
                        onClick={() => {
                          setSelectedStudentId(
                            String(student.id)
                          );
                          setReport(null);
                          setError("");
                        }}
                        type="button"
                        className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                          active
                            ? "bg-slate-900 text-white"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBulkIds.includes(student.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            toggleBulkStudent(student.id);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 shrink-0"
                        />
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            active
                              ? "bg-white/15 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {initials(
                            studentDisplayName(
                              student
                            )
                          ) || "ST"}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {studentDisplayName(
                              student
                            )}
                          </div>

                          <div
                            className={`truncate text-xs ${
                              active
                                ? "text-slate-300"
                                : "text-slate-500"
                            }`}
                          >
                            {student.admission_number ||
                              student.admission_no ||
                              "No admission no."}

                            {student.class_name
                              ? ` • ${student.class_name}`
                              : ""}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </aside>

          <main className="min-w-0">

            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selected Student
                  </label>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold">
                    {selectedStudent
                      ? studentDisplayName(
                          selectedStudent
                        )
                      : "Select a student"}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Template
                  </label>

                  <select
                    value={
                      selectedTemplateId
                    }
                    onChange={(event) => {
                      setSelectedTemplateId(
                        event.target.value
                      );
                      setReport(null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">
                      Use default template
                    </option>

                    {availableTemplates.map(
                      (template) => (
                        <option
                          key={template.id}
                          value={template.id}
                        >
                          {template.name}
                          {template.is_default
                            ? " • Default"
                            : ""}
                          {template.class_id ==
                          null
                            ? " • Global"
                            : ""}
                        </option>
                      )
                    )}
                  </select>

                  {selectedTemplate && (
                    <button
                      onClick={
                        editSelectedTemplate
                      }
                      className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Edit selected template
                    </button>
                  )}
                </div>

                <button
                  onClick={loadReportCard}
                  disabled={
                    !selectedStudentId ||
                    loadingReport
                  }
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingReport
                    ? "Generating..."
                    : "Generate Report"}
                </button>
              </div>

              {error && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </section>

            {!report ? (
              <div className="flex min-h-[560px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm print:hidden">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-500">
                    RC
                  </div>

                  <h2 className="text-lg font-bold">
                    Report Card Preview
                  </h2>

                  <p className="mt-1 max-w-md text-sm text-slate-500">
                    Select a student,
                    choose a saved template
                    and click Generate Report.
                  </p>
                </div>
              </div>
            ) : (
              <ReportCardSheet
                report={report}
              />
            )}

            {bulkReports.length > 0 && (
              <div className="hidden print:block">
                {bulkReports.map((item, index) => (
                  <div key={`bulk-${item.student?.id ?? index}`} className="bulk-print-page">
                    <ReportCardSheet report={item} />
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body {
            overflow: hidden !important;
          }

          body * {
            visibility: hidden;
          }

          .report-card-print,
          .report-card-print * {
            visibility: visible;
          }

          .bulk-print-active .report-card-print:not(.bulk-print-page .report-card-print) {
            visibility: hidden !important;
          }

          .bulk-print-page {
            break-after: page !important;
            page-break-after: always !important;
            display: block !important;
            visibility: visible !important;
          }

          .bulk-print-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }

          .report-card-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            width: 794px !important;
            height: 1123px !important;
            max-width: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ReportCardSheet({
  report,
}: {
  report: ReportCard;
}) {
  const template =
    report.template || null;

  const theme =
    themeFor(template);

  const settings =
    template?.settings || {};

  const elements =
    Array.isArray(
      template?.elements
    ) && template!.elements!.length
      ? template!.elements!
      : getFallbackElements();

  const visibleElements =
    elements.filter(
      (element) =>
        element.visible !== false
    );

  const fontFamily =
    theme.fontFamily || "Arial";

  return (
    <article
      className="report-card-print mx-auto"
      style={{
        width: 794,
        height: 1123,
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        color: theme.text,
        fontFamily,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `5px double ${theme.gold}`,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 8,
          border: `1px solid ${theme.border}`,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      />

      {visibleElements.map(
        (element, index) => (
          <TemplateElementRenderer
            key={
              element.id ||
              `${element.type}-${index}`
            }
            element={element}
            report={report}
            settings={settings}
            theme={theme}
          />
        )
      )}
    </article>
  );
}

function TemplateElementRenderer({
  element,
  report,
  settings,
  theme,
}: {
  element: TemplateElement;
  report: ReportCard;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  const x = element.x ?? 42;
  const y = element.y ?? 200;
  const width = element.width ?? 710;
  const height = element.height ?? 80;

  const style = element.style || {};

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    boxSizing: "border-box",
    overflow: "hidden",
    fontSize: element.fontSize || 11,
    fontWeight:
      element.fontWeight || "normal",
    textAlign:
      (element.align as any) || "left",
    color:
      style.color || theme.text,
    background:
      style.background || "transparent",
    border:
      style.borderWidth
        ? `${style.borderWidth}px solid ${
            style.borderColor ||
            theme.border
          }`
        : undefined,
    borderRadius:
      style.radius ??
      theme.borderRadius,
    padding:
      style.padding ?? 8,
  };

  switch (element.type) {
    case "school_header":
      return (
        <SchoolHeader
          style={baseStyle}
          report={report}
          settings={settings}
          theme={theme}
        />
      );

    case "report_title":
      return (
        <ReportTitle
          style={baseStyle}
          report={report}
          settings={settings}
          theme={theme}
        />
      );

    case "result_date":
      return (
        <ResultDate
          style={baseStyle}
          settings={settings}
          theme={theme}
        />
      );

    case "student_info":
      return (
        <StudentInfo
          style={baseStyle}
          report={report}
          theme={theme}
        />
      );

    case "academic_table":
      return (
        <AcademicTable
          style={baseStyle}
          report={report}
          settings={settings}
          theme={theme}
        />
      );

    case "co_scholastic":
      return (
        <CoScholastic
          style={baseStyle}
          report={report}
          settings={settings}
          theme={theme}
        />
      );

    case "summary":
      return (
        <Summary
          style={baseStyle}
          report={report}
          theme={theme}
        />
      );

    case "attendance":
      return (
        <Attendance
          style={baseStyle}
          report={report}
          settings={settings}
          theme={theme}
        />
      );

    case "remarks":
      return (
        <Remarks
          style={baseStyle}
          report={report}
          settings={settings}
          theme={theme}
        />
      );

    case "signatures":
      return (
        <Signatures
          style={baseStyle}
          settings={settings}
          theme={theme}
        />
      );

    case "logo":
      return (
        <LogoElement
          style={baseStyle}
          settings={settings}
        />
      );

    case "section_heading":
      return (
        <SectionHeading
          style={baseStyle}
          element={element}
          theme={theme}
        />
      );

    case "custom_text":
      return (
        <CustomText
          style={baseStyle}
          element={element}
          report={report}
        />
      );

    case "divider":
      return (
        <Divider
          style={baseStyle}
          theme={theme}
        />
      );

    default:
      return null;
  }
}

function SchoolHeader({
  style,
  settings,
  theme,
}: {
  style: React.CSSProperties;
  report: ReportCard;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  const school =
    settings.school || {};

  return (
    <div
      style={{
        ...style,
        background:
          style.background ||
          theme.headerBg,
        border: `1px solid ${
          theme.border
        }`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 10,
      }}
    >
      {school.logoUrl ? (
        <img
          src={school.logoUrl}
          alt="School Logo"
          style={{
            position: "absolute",
            left: 14,
            top: 14,
            width: 75,
            height: 75,
            objectFit: "contain",
          }}
        />
      ) : null}

      <div>
        <div
          style={{
            fontSize: 23,
            lineHeight: 1.1,
            fontWeight: 800,
            color: theme.primary,
            textTransform:
              "uppercase",
          }}
        >
          {school.name ||
            "EduOS School"}
        </div>

        {school.tagline && (
          <div
            style={{
              marginTop: 5,
              fontSize: 11,
              fontWeight: 600,
              color: theme.secondary,
            }}
          >
            {school.tagline}
          </div>
        )}

        {school.address && (
          <div
            style={{
              marginTop: 5,
              fontSize: 9,
              color: theme.muted,
            }}
          >
            {school.address}
          </div>
        )}

        <div
          style={{
            marginTop: 3,
            fontSize: 8,
            color: theme.muted,
          }}
        >
          {school.phone || ""}
          {school.phone &&
          school.email
            ? "  •  "
            : ""}
          {school.email || ""}
        </div>
      </div>
    </div>
  );
}

function ReportTitle({
  style,
  report,
  settings,
  theme,
}: {
  style: React.CSSProperties;
  report: ReportCard;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  const title =
    settings.report?.title ||
    "ACADEMIC REPORT CARD";

  const subtitle =
    settings.report?.subtitle ||
    report.exam?.name ||
    "";

  return (
    <div
      style={{
        ...style,
        border: "none",
        background:
          style.background ===
          "transparent"
            ? theme.primary
            : style.background,
        color:
          style.color ===
          "#ffffff"
            ? "#ffffff"
            : style.color,
        borderRadius: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: 5,
      }}
    >
      <div
        style={{
          fontSize:
            style.fontSize || 15,
          fontWeight: 800,
          letterSpacing:
            "0.04em",
        }}
      >
        {resolvePlaceholders(
          title,
          report
        )}
      </div>

      {subtitle && (
        <div
          style={{
            marginTop: 2,
            fontSize: 8,
            opacity: 0.9,
          }}
        >
          {resolvePlaceholders(
            subtitle,
            report
          )}
        </div>
      )}
    </div>
  );
}

function ResultDate({
  style,
  settings,
  theme,
}: {
  style: React.CSSProperties;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  if (
    settings.report?.showResultDate ===
    false
  ) {
    return null;
  }

  return (
    <div
      style={{
        ...style,
        border: "none",
        background:
          "transparent",
        color: theme.muted,
        padding: 4,
        display: "flex",
        alignItems: "center",
        justifyContent:
          "flex-end",
      }}
    >
      <strong>
        {settings.report
          ?.resultDateLabel ||
          "Result Declaration Date"}
        :{" "}
      </strong>
      <span style={{ marginLeft: 4 }}>
        {new Date().toLocaleDateString(
          "en-IN"
        )}
      </span>
    </div>
  );
}

function StudentInfo({
  style,
  report,
  theme,
}: {
  style: React.CSSProperties;
  report: ReportCard;
  theme: ReturnType<typeof themeFor>;
}) {
  const student =
    report.student || {};

  const cells = [
    [
      "Student Name",
      studentDisplayName(
        student
      ),
    ],
    [
      "Admission No.",
      student.admission_number ||
        student.admission_no ||
        "—",
    ],
    [
      "Class",
      student.class_name ||
        "—",
    ],
    [
      "Section",
      student.section ||
        "—",
    ],
    [
      "Father's Name",
      student.father_name ||
        "—",
    ],
    [
      "Mother's Name",
      student.mother_name ||
        "—",
    ],
    [
      "Roll No.",
      String(
        student.roll_no ??
          "—"
      ),
    ],
    [
      "Exam",
      report.exam?.name ||
        "—",
    ],
  ];

  return (
    <div
      style={{
        ...style,
        padding: 0,
        background:
          theme.softBg,
        border: `1px solid ${theme.border}`,
        display: "grid",
        gridTemplateColumns:
          "repeat(4, 1fr)",
      }}
    >
      {cells.map(
        ([label, value], index) => (
          <div
            key={label}
            style={{
              padding:
                "9px 10px",
              borderRight:
                index % 4 !== 3
                  ? `1px solid ${theme.border}`
                  : undefined,
              borderBottom:
                index < 4
                  ? `1px solid ${theme.border}`
                  : undefined,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 7,
                color: theme.muted,
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.05em",
                fontWeight: 700,
              }}
            >
              {label}
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 10,
                fontWeight: 700,
                overflow:
                  "hidden",
                whiteSpace:
                  "nowrap",
                textOverflow:
                  "ellipsis",
              }}
            >
              {value}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function AcademicTable({
  style,
  report,
  settings,
  theme,
}: {
  style: React.CSSProperties;
  report: ReportCard;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  const subjects =
    report.academic_subjects ||
    [];

  const academic =
    settings.academic || {};

  if (
    academic.enabled === false
  ) {
    return null;
  }

  return (
    <div
      style={{
        ...style,
        padding: 0,
        border: `1px solid ${theme.border}`,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          height: 31,
          display: "flex",
          alignItems: "center",
          padding:
            "0 10px",
          background:
            theme.tableHeader,
          color: "#ffffff",
          fontWeight: 800,
          fontSize: 11,
        }}
      >
        {academic.title ||
          "Marks Details"}
      </div>

      <div
        style={{
          height:
            Math.max(
              0,
              heightWithoutHeader(
                style.height
              )
            ),
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse:
              "collapse",
            tableLayout:
              "fixed",
            fontSize: 8,
          }}
        >
          <thead>
            <tr>
              <th
                style={th(theme)}
              >
                Subject
              </th>

              {academic.showMaxMarks !==
                false && (
                <th
                  style={th(
                    theme
                  )}
                >
                  Max
                </th>
              )}

              {academic.showPassMarks !==
                false && (
                <th
                  style={th(
                    theme
                  )}
                >
                  Pass
                </th>
              )}

              {academic.showObtained !==
                false && (
                <th
                  style={th(
                    theme
                  )}
                >
                  Obtained
                </th>
              )}

              <th
                style={th(theme)}
              >
                %
              </th>

              {academic.showGrade !==
                false && (
                <th
                  style={th(
                    theme
                  )}
                >
                  Grade
                </th>
              )}

              {academic.showRemark && (
                <th
                  style={{
                    ...th(theme),
                    width: 110,
                  }}
                >
                  Remark
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {subjects.length ===
            0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 14,
                    textAlign:
                      "center",
                    color:
                      theme.muted,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  No academic subjects
                  found.
                </td>
              </tr>
            ) : (
              subjects.map(
                (subject) => (
                  <tr
                    key={`${subject.subject_id}-${subject.subject_code || ""}`}
                  >
                    <td
                      style={td(
                        theme,
                        "left"
                      )}
                    >
                      <strong>
                        {
                          subject.subject_name
                        }
                      </strong>

                      {subject.is_optional && (
                        <span
                          style={{
                            marginLeft: 3,
                            fontSize: 7,
                            color:
                              theme.muted,
                          }}
                        >
                          Optional
                        </span>
                      )}
                    </td>

                    {academic.showMaxMarks !==
                      false && (
                      <td
                        style={td(
                          theme
                        )}
                      >
                        {formatNumber(
                          subject.max_marks
                        )}
                      </td>
                    )}

                    {academic.showPassMarks !==
                      false && (
                      <td
                        style={td(
                          theme
                        )}
                      >
                        {formatNumber(
                          subject.pass_marks
                        )}
                      </td>
                    )}

                    {academic.showObtained !==
                      false && (
                      <td
                        style={{
                          ...td(
                            theme
                          ),
                          fontWeight:
                            800,
                        }}
                      >
                        {formatNumber(
                          subject.marks_obtained
                        )}
                      </td>
                    )}

                    <td
                      style={td(
                        theme
                      )}
                    >
                      {subject.percentage ==
                      null
                        ? "—"
                        : `${formatNumber(
                            subject.percentage
                          )}%`}
                    </td>

                    {academic.showGrade !==
                      false && (
                      <td
                        style={{
                          ...td(
                            theme
                          ),
                          fontWeight:
                            800,
                        }}
                      >
                        {subject.grade ||
                          "—"}
                      </td>
                    )}

                    {academic.showRemark && (
                      <td
                        style={td(
                          theme,
                          "left"
                        )}
                      >
                        {subject.remark ||
                          "—"}
                      </td>
                    )}
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoScholastic({
  style,
  report,
  settings,
  theme,
}: {
  style: React.CSSProperties;
  report: ReportCard;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  const config =
    settings.co_scholastic ||
    {};

  if (config.enabled === false) {
    return null;
  }

  const items =
    report.co_scholastic ||
    [];

  return (
    <div
      style={{
        ...style,
        padding: 0,
        border: `1px solid ${theme.border}`,
      }}
    >
      <div
        style={{
          background:
            theme.tableHeader,
          color: "#ffffff",
          height: 28,
          display: "flex",
          alignItems: "center",
          padding: "0 9px",
          fontWeight: 800,
          fontSize: 10,
        }}
      >
        {config.title ||
          "Co-Scholastic Subjects"}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse:
            "collapse",
          fontSize: 8,
        }}
      >
        <thead>
          <tr>
            <th style={th(theme)}>
              Activity
            </th>
            <th style={th(theme)}>
              Grade
            </th>

            {config.showRemark && (
              <th style={th(theme)}>
                Remark
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={
                  config.showRemark
                    ? 3
                    : 2
                }
                style={{
                  ...td(theme),
                  padding: 8,
                }}
              >
                No co-scholastic
                entries.
              </td>
            </tr>
          ) : (
            items.map(
              (item, index) => (
                <tr
                  key={`${item.name}-${index}`}
                >
                  <td
                    style={td(
                      theme,
                      "left"
                    )}
                  >
                    {item.name}
                  </td>

                  <td
                    style={{
                      ...td(theme),
                      fontWeight: 800,
                    }}
                  >
                    {item.grade ||
                      item.value ||
                      "—"}
                  </td>

                  {config.showRemark && (
                    <td
                      style={td(
                        theme,
                        "left"
                      )}
                    >
                      {item.remark ||
                        "—"}
                    </td>
                  )}
                </tr>
              )
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function Summary({
  style,
  report,
  theme,
}: {
  style: React.CSSProperties;
  report: ReportCard;
  theme: ReturnType<typeof themeFor>;
}) {
  const result =
    report.result || {};

  const cells = [
    [
      "Total Marks",
      formatNumber(
        result.total_marks
      ),
    ],
    [
      "Maximum Marks",
      formatNumber(
        result.max_marks
      ),
    ],
    [
      "Percentage",
      result.percentage == null
        ? "—"
        : `${formatNumber(
            result.percentage
          )}%`,
    ],
    [
      "Grade",
      result.grade || "—",
    ],
    [
      "Rank",
      result.rank == null
        ? "—"
        : String(result.rank),
    ],
    [
      "Result",
      result.is_pass == null
        ? "—"
        : result.is_pass
          ? "PASS"
          : "FAIL",
    ],
  ];

  return (
    <div
      style={{
        ...style,
        padding: 0,
        display: "grid",
        gridTemplateColumns:
          "repeat(6, 1fr)",
        gap: 5,
        border: "none",
        overflow:
          "visible",
      }}
    >
      {cells.map(
        ([label, value]) => {
          const isResult =
            label === "Result";

          const isPass =
            isResult &&
            value === "PASS";

          const isFail =
            isResult &&
            value === "FAIL";

          return (
            <div
              key={label}
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 7,
                padding: 7,
                background:
                  theme.softBg,
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize: 6.5,
                  color:
                    theme.muted,
                  fontWeight: 700,
                  textTransform:
                    "uppercase",
                }}
              >
                {label}
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  fontWeight: 900,
                  color:
                    isPass
                      ? theme.success
                      : isFail
                        ? "#dc2626"
                        : theme.primary,
                }}
              >
                {value}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

function Attendance({
  style,
  report,
  settings,
  theme,
}: {
  style: React.CSSProperties;
  report: ReportCard;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  const config =
    settings.attendance ||
    {};

  if (config.enabled === false) {
    return null;
  }

  const attendance =
    report.attendance || {};

  const cells: Array<
    [string, string]
  > = [];

  if (
    config.showWorkingDays !==
    false
  ) {
    cells.push([
      "Working Days",
      formatNumber(
        attendance.total_days
      ),
    ]);
  }

  if (
    config.showPresentDays !==
    false
  ) {
    cells.push([
      "Present",
      formatNumber(
        attendance.present_days
      ),
    ]);
  }

  cells.push([
    "Absent",
    formatNumber(
      attendance.absent_days
    ),
  ]);

  if (
    config.showPercentage !==
    false
  ) {
    cells.push([
      "Attendance %",
      attendance.percentage ==
      null
        ? "—"
        : `${formatNumber(
            attendance.percentage
          )}%`,
    ]);
  }

  return (
    <div
      style={{
        ...style,
        padding: 6,
        border: `1px solid ${theme.border}`,
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: theme.primary,
          marginBottom: 5,
        }}
      >
        Attendance
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            `repeat(${Math.min(
              cells.length,
              4
            )}, 1fr)`,
          gap: 4,
        }}
      >
        {cells.map(
          ([label, value]) => (
            <div
              key={label}
              style={{
                padding: 5,
                border: `1px solid ${theme.border}`,
                borderRadius: 5,
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize: 6,
                  color:
                    theme.muted,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  marginTop: 2,
                  fontSize: 9,
                  fontWeight: 800,
                }}
              >
                {value}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Remarks({
  style,
  report,
  settings,
  theme,
}: {
  style: React.CSSProperties;
  report: ReportCard;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  const config =
    settings.remarks || {};

  if (config.enabled === false) {
    return null;
  }

  const items: Array<
    [string, string]
  > = [];

  if (
    config.classTeacher !==
    false
  ) {
    items.push([
      "Class Teacher's Remark",
      report.class_teacher_remark ||
        "—",
    ]);
  }

  if (
    config.principal !==
    false
  ) {
    items.push([
      "Principal's Remark",
      report.principal_remark ||
        "—",
    ]);
  }

  return (
    <div
      style={{
        ...style,
        padding: 6,
        display: "grid",
        gridTemplateColumns:
          items.length > 1
            ? "1fr 1fr"
            : "1fr",
        gap: 6,
        border: "none",
      }}
    >
      {items.map(
        ([label, value]) => (
          <div
            key={label}
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: 5,
              padding: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 7,
                fontWeight: 800,
                color:
                  theme.primary,
              }}
            >
              {label}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 8,
                color:
                  theme.text,
              }}
            >
              {value}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Signatures({
  style,
  settings,
  theme,
}: {
  style: React.CSSProperties;
  settings: TemplateSettings;
  theme: ReturnType<typeof themeFor>;
}) {
  const config =
    settings.signatures || {};

  if (config.enabled === false) {
    return null;
  }

  const labels: string[] = [];

  if (
    config.classTeacher !==
    false
  ) {
    labels.push(
      "Class Teacher"
    );
  }

  if (config.parent) {
    labels.push(
      "Parent / Guardian"
    );
  }

  if (
    config.principal !==
    false
  ) {
    labels.push("Principal");
  }

  if (!labels.length) {
    labels.push(
      "Class Teacher",
      "Principal"
    );
  }

  return (
    <div
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns:
          `repeat(${labels.length}, 1fr)`,
        alignItems: "end",
        gap: 25,
        padding:
          "25px 20px 5px",
        border: "none",
      }}
    >
      {labels.map(
        (label) => (
          <div
            key={label}
            style={{
              textAlign:
                "center",
              fontSize: 8,
              fontWeight: 700,
              color:
                theme.text,
            }}
          >
            <div
              style={{
                borderTop: `1px solid ${theme.text}`,
                marginBottom: 5,
              }}
            />

            {label}
          </div>
        )
      )}
    </div>
  );
}

function LogoElement({
  style,
  settings,
}: {
  style: React.CSSProperties;
  settings: TemplateSettings;
}) {
  const logo =
    settings.school?.logoUrl;

  if (!logo) {
    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          color: "#94a3b8",
          fontSize: 8,
          border:
            "1px dashed #cbd5e1",
        }}
      >
        SCHOOL LOGO
      </div>
    );
  }

  return (
    <div
      style={{
        ...style,
        padding: 3,
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent:
          "center",
      }}
    >
      <img
        src={logo}
        alt="School Logo"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
}

function SectionHeading({
  style,
  element,
  theme,
}: {
  style: React.CSSProperties;
  element: TemplateElement;
  theme: ReturnType<typeof themeFor>;
}) {
  return (
    <div
      style={{
        ...style,
        padding:
          "5px 10px",
        background:
          theme.primary,
        color: "#ffffff",
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        fontWeight: 800,
      }}
    >
      {element.label ||
        "Section Heading"}
    </div>
  );
}

function CustomText({
  style,
  element,
  report,
}: {
  style: React.CSSProperties;
  element: TemplateElement;
  report: ReportCard;
}) {
  const text =
    element.text ||
    element.value ||
    element.label ||
    "";

  return (
    <div
      style={{
        ...style,
        whiteSpace:
          "pre-wrap",
        overflowWrap:
          "break-word",
      }}
    >
      {resolvePlaceholders(
        text,
        report
      )}
    </div>
  );
}

function Divider({
  style,
  theme,
}: {
  style: React.CSSProperties;
  theme: ReturnType<typeof themeFor>;
}) {
  return (
    <div
      style={{
        ...style,
        height: 1,
        padding: 0,
        background:
          theme.primary,
        border: "none",
        borderRadius: 0,
      }}
    />
  );
}

function getFallbackElements(): TemplateElement[] {
  return [
    {
      id: "school-header",
      type: "school_header",
      label: "School Header",
      x: 42,
      y: 36,
      width: 710,
      height: 118,
      fontSize: 27,
      fontWeight: "bold",
      align: "center",
      visible: true,
      style: {
        background: "#f1f5ff",
        color: "#1647b8",
        borderColor: "#dce5fb",
        borderWidth: 1,
        radius: 8,
        padding: 8,
      },
    },
    {
      id: "report-title",
      type: "report_title",
      label:
        "Academic Report Card",
      x: 250,
      y: 145,
      width: 294,
      height: 45,
      fontSize: 15,
      fontWeight: "bold",
      align: "center",
      visible: true,
      style: {
        background: "#1647b8",
        color: "#ffffff",
        borderColor:
          "transparent",
        borderWidth: 0,
        radius: 22,
        padding: 8,
      },
    },
    {
      id: "result-date",
      type: "result_date",
      label:
        "Result Declaration Date",
      x: 570,
      y: 198,
      width: 182,
      height: 28,
      fontSize: 10,
      fontWeight: "bold",
      align: "right",
      visible: true,
      style: {
        background:
          "transparent",
        color: "#667085",
        borderColor:
          "transparent",
        borderWidth: 0,
        radius: 0,
        padding: 4,
      },
    },
    {
      id: "student-info",
      type: "student_info",
      label:
        "Student Details",
      x: 42,
      y: 230,
      width: 710,
      height: 160,
      fontSize: 11,
      fontWeight: "normal",
      align: "left",
      visible: true,
      style: {
        background: "#f4f7ff",
        color: "#243044",
        borderColor: "#d7ddeb",
        borderWidth: 1,
        radius: 8,
        padding: 8,
      },
    },
    {
      id: "academic-table",
      type: "academic_table",
      label:
        "Marks Details",
      x: 42,
      y: 408,
      width: 710,
      height: 300,
      fontSize: 10,
      fontWeight: "normal",
      align: "left",
      visible: true,
      style: {
        background: "#ffffff",
        color: "#243044",
        borderColor: "#d7ddeb",
        borderWidth: 1,
        radius: 8,
        padding: 8,
      },
    },
    {
      id: "co-scholastic",
      type: "co_scholastic",
      label:
        "Co-Scholastic Subjects",
      x: 42,
      y: 724,
      width: 710,
      height: 142,
      fontSize: 10,
      fontWeight: "normal",
      align: "left",
      visible: true,
      style: {
        background: "#ffffff",
        color: "#243044",
        borderColor: "#d7ddeb",
        borderWidth: 1,
        radius: 8,
        padding: 8,
      },
    },
    {
      id: "summary",
      type: "summary",
      label:
        "Result Summary",
      x: 42,
      y: 882,
      width: 710,
      height: 86,
      fontSize: 10,
      fontWeight: "normal",
      align: "left",
      visible: true,
      style: {
        background: "#ffffff",
        color: "#243044",
        borderColor: "#d7ddeb",
        borderWidth: 1,
        radius: 8,
        padding: 8,
      },
    },
    {
      id: "signatures",
      type: "signatures",
      label: "Signatures",
      x: 42,
      y: 990,
      width: 710,
      height: 80,
      fontSize: 10,
      fontWeight: "bold",
      align: "center",
      visible: true,
      style: {
        background:
          "transparent",
        color: "#243044",
        borderColor:
          "transparent",
        borderWidth: 0,
        radius: 8,
        padding: 8,
      },
    },
  ];
}

function heightWithoutHeader(
  height: number | string | undefined
): number {
  const numericHeight =
    typeof height === "number"
      ? height
      : Number.parseFloat(String(height ?? 0));

  return Math.max(
    40,
    (Number.isFinite(numericHeight) ? numericHeight : 0) - 31
  );
}

function th(
  theme: ReturnType<typeof themeFor>
): React.CSSProperties {
  return {
    background:
      theme.softBg,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    padding:
      "5px 4px",
    fontSize: 7.5,
    fontWeight: 800,
    textAlign:
      "center",
  };
}

function td(
  theme: ReturnType<typeof themeFor>,
  align:
    | "left"
    | "center" = "center"
): React.CSSProperties {
  return {
    border: `1px solid ${theme.border}`,
    padding:
      "5px 4px",
    fontSize: 7.5,
    textAlign: align,
    verticalAlign:
      "middle",
  };
}