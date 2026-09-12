 "use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SectionOption = {
  id: number;
  class_id: number;
  name: string;
};

type ExamOption = {
  id: number;
  name: string;
  description?: string | null;
  exam_type?: string | null;
  academic_year?: string | null;
  term?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  is_editable: boolean;
};

type SubjectOption = {
  section_id: number;
  section_name: string;
  class_id: number;
  subject_id: number;
  subject_name: string;
  subject_code?: string | null;
  exam_id: number;
  exam_name: string;
  exam_status: string;
  is_editable: boolean;
  max_marks: number;
  pass_marks: number;
  is_optional: boolean;
  include_in_result: boolean;
};

type AssessmentOptionsResponse = {
  sections: SectionOption[];
  exams: ExamOption[];
  subjects: SubjectOption[];
};

type MarkRow = {
  student_id: number;
  admission_number: string;
  student_name: string;
  marks_id: number | null;
  marks_obtained: number | null;
  max_marks: number;
  percentage: number | null;
  grade: string | null;
};

type AssessmentResponse = {
  section: {
    id: number;
    class_id: number;
    name: string;
  };
  exam: ExamOption;
  subject: {
    id: number;
    name: string;
    code?: string | null;
    max_marks: number;
    pass_marks: number;
    is_optional: boolean;
    include_in_result: boolean;
  };
  students: MarkRow[];
};

type BulkMarkResponse = {
  saved_count: number;
  marks: Array<{
    id: number;
    student_id: number;
    exam_id: number;
    subject_id: number;
    marks_obtained: number;
    max_marks: number;
  }>;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

function apiUrl(path: string) {
  return `${API_BASE.replace(/\/$/, "")}${path}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function getAccessToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
    }

    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload
        ? String((payload as { detail?: unknown }).detail)
        : typeof payload === "string"
          ? payload
          : response.status === 401
            ? "Session expired or authentication token is missing. Please log in again."
            : `Request failed with status ${response.status}.`;

    throw new Error(detail);
  }

  return payload as T;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function gradeForPercentage(value: number | null) {
  if (value === null) return null;
  if (value >= 90) return "A+";
  if (value >= 80) return "A";
  if (value >= 70) return "B+";
  if (value >= 60) return "B";
  if (value >= 50) return "C";
  if (value >= 40) return "D";
  return "F";
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function statusClass(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "DRAFT":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "LOCKED":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "PUBLISHED":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function TeacherMarksPage() {
  const [options, setOptions] = useState<AssessmentOptionsResponse>({
    sections: [],
    exams: [],
    subjects: [],
  });

  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [rows, setRows] = useState<MarkRow[]>([]);
  const [initialRows, setInitialRows] = useState<MarkRow[]>([]);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadOptions = useCallback(async (sectionId?: string) => {
    setLoadingOptions(true);
    setPageError("");

    try {
      const query = sectionId
        ? `?section_id=${encodeURIComponent(sectionId)}`
        : "";

      const data = await apiFetch<AssessmentOptionsResponse>(
        `/teacher/me/assessment-options${query}`,
      );

      setOptions(data);

      if (sectionId) {
        const stillExists = data.sections.some(
          (section) => String(section.id) === sectionId,
        );
        if (!stillExists) {
          setSelectedSectionId("");
          setSelectedExamId("");
          setSelectedSubjectId("");
        }
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const sectionSubjects = useMemo(() => {
    if (!selectedSectionId) return [];

    const seen = new Set<number>();
    return options.subjects
      .filter((item) => String(item.section_id) === selectedSectionId)
      .filter((item) => {
        if (seen.has(item.subject_id)) return false;
        seen.add(item.subject_id);
        return true;
      })
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
  }, [options.subjects, selectedSectionId]);

  const sectionExams = useMemo(() => {
    if (!selectedSectionId) return [];

    const examIds = new Set(
      options.subjects
        .filter((item) => String(item.section_id) === selectedSectionId)
        .map((item) => item.exam_id),
    );

    return options.exams
      .filter((exam) => examIds.has(exam.id))
      .sort((a, b) => {
        const aDate = a.start_date || "";
        const bDate = b.start_date || "";
        if (aDate !== bDate) return bDate.localeCompare(aDate);
        return a.name.localeCompare(b.name);
      });
  }, [options.exams, options.subjects, selectedSectionId]);

  const selectedSubjectOptions = useMemo(() => {
    if (!selectedSectionId || !selectedExamId) return [];

    return options.subjects
      .filter(
        (item) =>
          String(item.section_id) === selectedSectionId &&
          String(item.exam_id) === selectedExamId,
      )
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
  }, [
    options.subjects,
    selectedSectionId,
    selectedExamId,
  ]);

  const selectedExam = useMemo(
    () =>
      options.exams.find(
        (exam) => String(exam.id) === selectedExamId,
      ) || null,
    [options.exams, selectedExamId],
  );

  const selectedSubject = useMemo(
    () =>
      selectedSubjectOptions.find(
        (subject) => String(subject.subject_id) === selectedSubjectId,
      ) || null,
    [selectedSubjectOptions, selectedSubjectId],
  );

  const editable =
    Boolean(assessment?.exam.is_editable) &&
    Boolean(selectedSubject?.is_editable);

  const loadRegister = useCallback(async () => {
    if (!selectedSectionId || !selectedExamId || !selectedSubjectId) {
      setAssessment(null);
      setRows([]);
      setInitialRows([]);
      return;
    }

    setLoadingRegister(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const path =
        `/teacher/sections/${selectedSectionId}/assessments` +
        `?exam_id=${encodeURIComponent(selectedExamId)}` +
        `&subject_id=${encodeURIComponent(selectedSubjectId)}`;

      const data = await apiFetch<AssessmentResponse>(path);

      setAssessment(data);
      setRows(data.students);
      setInitialRows(data.students);
    } catch (error) {
      setAssessment(null);
      setRows([]);
      setInitialRows([]);
      setPageError(getErrorMessage(error));
    } finally {
      setLoadingRegister(false);
    }
  }, [selectedSectionId, selectedExamId, selectedSubjectId]);

  useEffect(() => {
    if (!selectedSectionId) {
      setSelectedExamId("");
      setSelectedSubjectId("");
      setAssessment(null);
      setRows([]);
      setInitialRows([]);
      return;
    }

    void loadOptions(selectedSectionId);
    setSelectedExamId("");
    setSelectedSubjectId("");
    setAssessment(null);
    setRows([]);
    setInitialRows([]);
  }, [selectedSectionId, loadOptions]);

  useEffect(() => {
    if (!selectedExamId) {
      setSelectedSubjectId("");
      setAssessment(null);
      setRows([]);
      setInitialRows([]);
      return;
    }

    const currentSubjectStillValid = selectedSubjectOptions.some(
      (subject) => String(subject.subject_id) === selectedSubjectId,
    );

    if (!currentSubjectStillValid) {
      setSelectedSubjectId("");
      setAssessment(null);
      setRows([]);
      setInitialRows([]);
    }
  }, [selectedExamId, selectedSubjectId, selectedSubjectOptions]);

  useEffect(() => {
    void loadRegister();
  }, [loadRegister]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      return (
        row.student_name.toLowerCase().includes(query) ||
        String(row.admission_number || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [rows, search]);

  const summary = useMemo(() => {
    const total = rows.length;
    const markedRows = rows.filter(
      (row) =>
        row.marks_obtained !== null &&
        row.marks_obtained !== undefined,
    );

    const pending = total - markedRows.length;
    const average =
      markedRows.length > 0
        ? markedRows.reduce((sum, row) => {
            const percentage =
              row.percentage ??
              (row.max_marks > 0 && row.marks_obtained !== null
                ? (row.marks_obtained / row.max_marks) * 100
                : 0);
            return sum + percentage;
          }, 0) / markedRows.length
        : null;

    const passCount = markedRows.filter((row) => {
      const percentage =
        row.percentage ??
        (row.max_marks > 0 && row.marks_obtained !== null
          ? (row.marks_obtained / row.max_marks) * 100
          : null);

      const passMarks = assessment?.subject.pass_marks ?? 0;
      const passPercentage =
        assessment?.subject.max_marks && assessment.subject.max_marks > 0
          ? (passMarks / assessment.subject.max_marks) * 100
          : 0;

      return percentage !== null && percentage >= passPercentage;
    }).length;

    const passRate =
      markedRows.length > 0 ? (passCount / markedRows.length) * 100 : null;

    return {
      total,
      marked: markedRows.length,
      pending,
      average,
      passRate,
    };
  }, [assessment, rows]);

  const invalidRowIds = useMemo(() => {
    const invalid = new Set<number>();

    rows.forEach((row) => {
      if (row.marks_obtained === null || row.marks_obtained === undefined) {
        return;
      }

      if (
        Number.isNaN(row.marks_obtained) ||
        row.marks_obtained < 0 ||
        row.marks_obtained > row.max_marks
      ) {
        invalid.add(row.student_id);
      }
    });

    return invalid;
  }, [rows]);

  const hasChanges = useMemo(() => {
    if (rows.length !== initialRows.length) return true;

    return rows.some((row, index) => {
      const initial = initialRows[index];
      return (
        row.student_id !== initial.student_id ||
        row.marks_obtained !== initial.marks_obtained
      );
    });
  }, [initialRows, rows]);

  const updateMarks = (studentId: number, value: string) => {
    if (!editable) return;

    const trimmed = value.trim();

    if (trimmed === "") {
      setRows((current) =>
        current.map((row) =>
          row.student_id === studentId
            ? {
                ...row,
                marks_obtained: null,
                percentage: null,
                grade: null,
              }
            : row,
        ),
      );
      return;
    }

    const parsed = Number(trimmed);

    setRows((current) =>
      current.map((row) => {
        if (row.student_id !== studentId) return row;

        if (Number.isNaN(parsed)) {
          return {
            ...row,
            marks_obtained: Number.NaN,
            percentage: null,
            grade: null,
          };
        }

        const percentage =
          row.max_marks > 0 ? (parsed / row.max_marks) * 100 : null;

        return {
          ...row,
          marks_obtained: parsed,
          percentage:
            percentage === null ? null : Number(percentage.toFixed(2)),
          grade: gradeForPercentage(percentage),
        };
      }),
    );

    setSuccessMessage("");
  };

  const markAllPresentEquivalent = () => {
    if (!editable || rows.length === 0) return;

    setRows((current) =>
      current.map((row) => ({
        ...row,
        marks_obtained: row.marks_obtained,
      })),
    );
  };

  const saveMarks = async () => {
    if (!assessment || !selectedSectionId || !selectedExamId || !selectedSubjectId) {
      return;
    }

    if (!editable) {
      setPageError(
        "This assessment is locked or published and cannot be edited.",
      );
      return;
    }

    if (invalidRowIds.size > 0) {
      setPageError(
        "Please correct the highlighted marks. Marks must be between 0 and the configured maximum.",
      );
      return;
    }

    const changedRows = rows.filter((row) => {
      const initial = initialRows.find(
        (item) => item.student_id === row.student_id,
      );
      return initial?.marks_obtained !== row.marks_obtained;
    });

    if (changedRows.length === 0) {
      setSuccessMessage("No mark changes to save.");
      return;
    }

    setSaving(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const payload = {
        exam_id: Number(selectedExamId),
        subject_id: Number(selectedSubjectId),
        items: changedRows.map((row) => ({
          student_id: row.student_id,
          marks_obtained: row.marks_obtained ?? 0,
          max_marks: assessment.subject.max_marks,
        })),
      };

      const response = await apiFetch<BulkMarkResponse>("/marks/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const savedByStudent = new Map(
        response.marks.map((mark) => [mark.student_id, mark]),
      );

      const refreshedRows = rows.map((row) => {
        const saved = savedByStudent.get(row.student_id);
        if (!saved) return row;

        const percentage =
          saved.max_marks > 0
            ? Number(
                ((saved.marks_obtained / saved.max_marks) * 100).toFixed(2),
              )
            : null;

        return {
          ...row,
          marks_id: saved.id,
          marks_obtained: saved.marks_obtained,
          max_marks: saved.max_marks,
          percentage,
          grade: gradeForPercentage(percentage),
        };
      });

      setRows(refreshedRows);
      setInitialRows(refreshedRows);

      setSuccessMessage(
        `${response.saved_count} mark${response.saved_count === 1 ? "" : "s"} saved successfully.`,
      );
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    if (!editable) return;
    setRows(initialRows);
    setPageError("");
    setSuccessMessage("Unsaved changes were discarded.");
  };

  const selectedSection = options.sections.find(
    (section) => String(section.id) === selectedSectionId,
  );

  const displaySubject =
    assessment?.subject ||
    selectedSubject ||
    null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 overflow-hidden rounded-3xl bg-[#0b1f3a] text-white shadow-sm">
          <div className="px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  <span className="h-2 w-2 rounded-full bg-blue-300" />
                  Teacher Workspace
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Assessments &amp; Marks
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                  Enter and review marks only for the sections and subjects
                  assigned to you. Exam configuration and editability come
                  directly from the academic setup.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xs font-medium text-blue-200">
                  Current register
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selectedSection?.name || "Select a section"}
                  {displaySubject?.name
                    ? ` • ${displaySubject.name}`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </header>

        {pageError && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="mt-0.5 font-bold">!</span>
            <div className="flex-1">{pageError}</div>
            <button
              type="button"
              onClick={() => setPageError("")}
              className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-100"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
              ✓
            </span>
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Assessment Selection
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose the section, examination and assigned subject you want
                to manage.
              </p>
            </div>

            {loadingOptions && (
              <div className="text-xs font-medium text-slate-400">
                Loading academic options…
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Section
              </span>
              <select
                value={selectedSectionId}
                onChange={(event) =>
                  setSelectedSectionId(event.target.value)
                }
                disabled={loadingOptions}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">Select section</option>
                {options.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Examination
              </span>
              <select
                value={selectedExamId}
                onChange={(event) =>
                  setSelectedExamId(event.target.value)
                }
                disabled={!selectedSectionId || sectionExams.length === 0}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">Select examination</option>
                {sectionExams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} — {statusLabel(exam.status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assigned Subject
              </span>
              <select
                value={selectedSubjectId}
                onChange={(event) =>
                  setSelectedSubjectId(event.target.value)
                }
                disabled={
                  !selectedExamId || selectedSubjectOptions.length === 0
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">Select subject</option>
                {selectedSubjectOptions.map((subject) => (
                  <option
                    key={`${subject.exam_id}-${subject.subject_id}`}
                    value={subject.subject_id}
                  >
                    {subject.subject_name}
                    {subject.subject_code
                      ? ` (${subject.subject_code})`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedSectionId && sectionExams.length === 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No configured examinations are available for your assigned
              subjects in this section.
            </div>
          )}

          {selectedExamId && selectedSubjectOptions.length === 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This examination has no configured subject mapping that you are
              assigned to teach in the selected section.
            </div>
          )}
        </section>

        {selectedExam && selectedSubject && (
          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Examination
              </div>
              <div className="mt-2 truncate text-base font-bold text-slate-900">
                {selectedExam.name}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {selectedExam.start_date
                  ? formatDate(selectedExam.start_date)
                  : "Date not set"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Maximum Marks
              </div>
              <div className="mt-2 text-2xl font-bold text-[#0b1f3a]">
                {formatNumber(
                  assessment?.subject.max_marks ?? selectedSubject.max_marks,
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Pass marks:{" "}
                {formatNumber(
                  assessment?.subject.pass_marks ?? selectedSubject.pass_marks,
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Exam Status
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ring-1 ${statusClass(
                    assessment?.exam.status || selectedExam.status,
                  )}`}
                >
                  {statusLabel(
                    assessment?.exam.status || selectedExam.status,
                  )}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {editable ? "Marks entry is enabled." : "Read-only register."}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Result Setting
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">
                {selectedSubject.include_in_result
                  ? "Included in result"
                  : "Excluded from result"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {selectedSubject.is_optional
                  ? "Optional subject"
                  : "Main configured subject"}
              </div>
            </div>
          </section>
        )}

        {assessment && (
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      Student Marks Register
                    </h2>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {assessment.section.name}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {assessment.subject.name}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Enter marks out of {formatNumber(assessment.subject.max_marks)}.
                    Blank values remain unentered; no attendance status is
                    inferred here.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                  <div className="relative min-w-0 sm:min-w-[260px]">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      ⌕
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search student or admission no."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    />
                  </div>

                  {editable && (
                    <>
                      <button
                        type="button"
                        onClick={resetChanges}
                        disabled={!hasChanges || saving}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={saveMarks}
                        disabled={
                          saving ||
                          loadingRegister ||
                          invalidRowIds.size > 0 ||
                          !hasChanges
                        }
                        className="rounded-xl bg-[#0b1f3a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102b50] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {saving ? "Saving…" : "Save Marks"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!editable && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="mt-0.5 font-bold text-slate-500">i</span>
                  <div>
                    <div className="font-semibold">
                      This register is read-only.
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      The selected exam is {statusLabel(
                        assessment.exam.status,
                      ).toLowerCase()}, so marks cannot be changed.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 border-b border-slate-100 sm:grid-cols-5">
              <div className="border-r border-slate-100 px-4 py-4 sm:px-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Students
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {summary.total}
                </div>
              </div>
              <div className="border-r border-slate-100 px-4 py-4 sm:px-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Marked
                </div>
                <div className="mt-1 text-xl font-bold text-emerald-600">
                  {summary.marked}
                </div>
              </div>
              <div className="border-r border-slate-100 px-4 py-4 sm:px-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pending
                </div>
                <div className="mt-1 text-xl font-bold text-amber-600">
                  {summary.pending}
                </div>
              </div>
              <div className="border-r border-slate-100 px-4 py-4 sm:px-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Average
                </div>
                <div className="mt-1 text-xl font-bold text-[#0b1f3a]">
                  {summary.average === null
                    ? "—"
                    : `${summary.average.toFixed(1)}%`}
                </div>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pass Rate
                </div>
                <div className="mt-1 text-xl font-bold text-[#0b1f3a]">
                  {summary.passRate === null
                    ? "—"
                    : `${summary.passRate.toFixed(1)}%`}
                </div>
              </div>
            </div>

            {loadingRegister ? (
              <div className="flex min-h-[300px] items-center justify-center px-6">
                <div className="text-center">
                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#0b1f3a]" />
                  <p className="mt-4 text-sm font-medium text-slate-500">
                    Loading student register…
                  </p>
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                  —
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  No active students found
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  There are no active students currently assigned to this
                  section.
                </p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <h3 className="text-base font-bold text-slate-900">
                  No matching students
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Try a different student name or admission number.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[920px] w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="w-14 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                        #
                      </th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Student
                      </th>
                      <th className="w-44 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Admission No.
                      </th>
                      <th className="w-48 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Marks
                      </th>
                      <th className="w-36 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Percentage
                      </th>
                      <th className="w-28 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Grade
                      </th>
                      <th className="w-32 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Result
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row, index) => {
                      const invalid = invalidRowIds.has(row.student_id);

                      const percentage =
                        row.percentage ??
                        (row.marks_obtained !== null &&
                        row.max_marks > 0 &&
                        !Number.isNaN(row.marks_obtained)
                          ? (row.marks_obtained / row.max_marks) * 100
                          : null);

                      const grade =
                        row.grade ?? gradeForPercentage(percentage);

                      const passPercentage =
                        assessment.subject.max_marks > 0
                          ? (assessment.subject.pass_marks /
                              assessment.subject.max_marks) *
                            100
                          : 0;

                      const pass =
                        percentage !== null &&
                        !Number.isNaN(percentage) &&
                        percentage >= passPercentage;

                      return (
                        <tr
                          key={row.student_id}
                          className={`transition ${
                            invalid
                              ? "bg-red-50/50"
                              : "hover:bg-slate-50/70"
                          }`}
                        >
                          <td className="px-5 py-4 text-sm font-semibold text-slate-400">
                            {rows.findIndex(
                              (item) => item.student_id === row.student_id,
                            ) + 1}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0b1f3a] text-xs font-bold text-white">
                                {row.student_name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900">
                                  {row.student_name}
                                </div>
                                <div className="mt-0.5 text-xs text-slate-400">
                                  Student ID #{row.student_id}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-sm font-medium text-slate-600">
                            {row.admission_number || "—"}
                          </td>

                          <td className="px-4 py-4">
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min={0}
                                max={row.max_marks}
                                step="0.01"
                                inputMode="decimal"
                                value={
                                  row.marks_obtained === null ||
                                  Number.isNaN(row.marks_obtained)
                                    ? ""
                                    : row.marks_obtained
                                }
                                onChange={(event) =>
                                  updateMarks(
                                    row.student_id,
                                    event.target.value,
                                  )
                                }
                                disabled={!editable}
                                placeholder="Not entered"
                                className={`w-32 rounded-xl border px-3 py-2.5 text-sm font-bold outline-none transition ${
                                  invalid
                                    ? "border-red-300 bg-red-50 text-red-700 focus:border-red-500 focus:ring-4 focus:ring-red-50"
                                    : "border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                                } disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500`}
                              />
                              <span className="ml-2 text-xs font-semibold text-slate-400">
                                / {formatNumber(row.max_marks)}
                              </span>
                            </div>
                            {invalid && (
                              <div className="mt-1.5 text-xs font-medium text-red-600">
                                Enter 0–{formatNumber(row.max_marks)}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {percentage === null || Number.isNaN(percentage) ? (
                              <span className="text-sm text-slate-400">—</span>
                            ) : (
                              <span className="text-sm font-bold text-slate-800">
                                {percentage.toFixed(2)}%
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {grade ? (
                              <span className="inline-flex min-w-10 justify-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                                {grade}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {percentage === null ||
                            Number.isNaN(percentage) ? (
                              <span className="text-xs font-semibold text-slate-400">
                                Pending
                              </span>
                            ) : (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1.5 text-xs font-bold ${
                                  pass
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {pass ? "Pass" : "Fail"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {filteredRows.length} of {rows.length} students
                </span>
                <span>
                  Pass threshold:{" "}
                  <strong className="text-slate-700">
                    {formatNumber(assessment.subject.pass_marks)} /{" "}
                    {formatNumber(assessment.subject.max_marks)}
                  </strong>
                </span>
              </div>
            </div>
          </section>
        )}

        {!assessment && !loadingRegister && (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b1f3a] text-xl font-bold text-white">
              M
            </div>
            <h2 className="mt-5 text-lg font-bold text-slate-900">
              Select an assessment to begin
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Start by selecting one of your assigned sections, then choose an
              examination and subject. The register will load only when the
              selected combination is valid for your teacher assignment.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
