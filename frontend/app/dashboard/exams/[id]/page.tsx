"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Exam = {
  id: number;
  name: string;
  description?: string | null;
  exam_type: string;
  academic_year?: string | null;
  term?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  include_in_result: boolean;
  weightage: number;
  status: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type ExamSubject = {
  exam_id: number;
  class_id: number;
  subject_id: number;
  max_marks: number;
  pass_marks: number;
  is_optional: boolean;
  include_in_result: boolean;
};

type ExamSchedule = {
  id: number;
  exam_id: number;
  class_id: number;
  subject_id: number;
  exam_date: string;
  shift: string;
  start_time: string;
  end_time: string;
  room?: string | null;
  instructions?: string | null;
  is_active: boolean;
};

type SchoolClass = {
  id: number;
  name?: string;
  class_name?: string;
  section?: string | null;
};

type Subject = {
  id: number;
  name?: string;
  subject_name?: string;
  code?: string | null;
};

const API = "http://127.0.0.1:8000";

const examTypeLabels: Record<string, string> = {
  UNIT_TEST: "Unit Test",
  PERIODIC_TEST: "Periodic Test",
  HALF_YEARLY: "Half Yearly",
  ANNUAL: "Annual",
  PRE_BOARD: "Pre-Board",
  CLASS_TEST: "Class Test",
  MONTHLY_TEST: "Monthly Test",
  PRACTICAL: "Practical",
  EXAM: "Exam",
  OTHER: "Other",
};

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  LOCKED: {
    label: "Locked",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

function getClassName(item: SchoolClass) {
  return item.name || item.class_name || `Class ${item.id}`;
}

function getSubjectName(item: Subject) {
  return item.name || item.subject_name || `Subject ${item.id}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "—";

  const parts = value.split(":");
  if (parts.length < 2) return value;

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getInitials(name?: string) {
  if (!name) return "EX";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}


type WorkflowButtonProps = {
  step: string;
  icon: string;
  title: string;
  onClick: () => void;
};

function WorkflowButton({
  step,
  icon,
  title,
  onClick,
}: WorkflowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700 transition group-hover:bg-indigo-100 group-hover:text-indigo-700">
        {step}
      </span>
      <span className="text-lg leading-none">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">Open</span>
      </span>
      <span className="ml-auto text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600">
        →
      </span>
    </button>
  );
}

export default function ExamDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const examId = Number(params?.id);

  const [exam, setExam] = useState<Exam | null>(null);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function fetchJson<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem("access_token");

    if (!token) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      window.location.href = "/login";
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${API}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    const text = await response.text();

    let data: unknown = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      window.location.href = "/login";
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      let message = `Request failed (${response.status})`;

      if (
        typeof data === "object" &&
        data !== null &&
        "detail" in data
      ) {
        const detail = (data as { detail?: unknown }).detail;

        if (typeof detail === "string") {
          message = detail;
        } else if (detail) {
          message = JSON.stringify(detail);
        }
      } else if (typeof data === "string" && data.trim()) {
        message = data;
      }

      throw new Error(message);
    }

    return data as T;
  }

  async function loadPage() {
    if (!examId || Number.isNaN(examId)) {
      setError("Invalid exam ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [examData, subjectData, scheduleData, classData, allSubjects] =
        await Promise.all([
          fetchJson<Exam>(`/exams/${examId}`),
          fetchJson<ExamSubject[]>(`/exam-subjects/exam/${examId}`),
          fetchJson<ExamSchedule[]>(
            `/exam-schedules/exam/${examId}`
          ),
          fetchJson<SchoolClass[]>("/classes"),
          fetchJson<Subject[]>("/subjects/"),
        ]);

      setExam(examData);
      setExamSubjects(Array.isArray(subjectData) ? subjectData : []);
      setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setSubjects(Array.isArray(allSubjects) ? allSubjects : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load exam details."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, [examId]);

  const classMap = useMemo(() => {
    return new Map(classes.map((item) => [item.id, item]));
  }, [classes]);

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((item) => [item.id, item]));
  }, [subjects]);

  const uniqueClassIds = useMemo(() => {
    return [...new Set(examSubjects.map((item) => item.class_id))];
  }, [examSubjects]);

  const totalMaxMarks = useMemo(() => {
    return examSubjects.reduce(
      (sum, item) => sum + Number(item.max_marks || 0),
      0
    );
  }, [examSubjects]);

  const totalPassMarks = useMemo(() => {
    return examSubjects.reduce(
      (sum, item) => sum + Number(item.pass_marks || 0),
      0
    );
  }, [examSubjects]);

  const upcomingSchedules = useMemo(() => {
    return [...schedules]
      .filter((item) => item.is_active)
      .sort((a, b) => {
        const first = `${a.exam_date} ${a.start_time}`;
        const second = `${b.exam_date} ${b.start_time}`;
        return first.localeCompare(second);
      });
  }, [schedules]);

  const scheduleDays = useMemo(() => {
    return new Set(
      schedules
        .filter((item) => item.is_active)
        .map((item) => item.exam_date)
    ).size;
  }, [schedules]);

  const status = exam
    ? statusConfig[exam.status] || statusConfig.DRAFT
    : statusConfig.DRAFT;

  const isLocked =
    exam?.status === "LOCKED" || exam?.status === "PUBLISHED";

  async function copyExam() {
    if (!exam) return;

    const confirmed = window.confirm(
      `Create a copy of "${exam.name}"?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");

      await fetchJson(`/exams/${exam.id}/copy`, {
        method: "POST",
      });

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to copy exam."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function changeStatus(nextStatus: string) {
    if (!exam) return;

    const statusLabel =
      statusConfig[nextStatus]?.label || nextStatus;

    const confirmed = window.confirm(
      `Change exam status to "${statusLabel}"?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");

      const updated = await fetchJson<Exam>(
        `/exams/${exam.id}/status?status=${encodeURIComponent(
          nextStatus
        )}`,
        {
          method: "PATCH",
        }
      );

      setExam(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change exam status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function classLabel(classId: number) {
    const item = classMap.get(classId);

    if (!item) {
      return `Class ${classId}`;
    }

    return getClassName(item);
  }

  function subjectLabel(subjectId: number) {
    const item = subjectMap.get(subjectId);

    if (!item) {
      return `Subject ${subjectId}`;
    }

    return getSubjectName(item);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl bg-white shadow-sm"
              />
            ))}
          </div>

          <div className="mt-6 h-80 animate-pulse rounded-3xl bg-white shadow-sm" />
        </div>
      </main>
    );
  }

  if (!exam) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => router.push("/dashboard/exams")}
            className="mb-6 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to Exams
          </button>

          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-bold text-red-800">
              Unable to load exam
            </h1>
            <p className="mt-2 text-sm text-red-700">
              {error || "Exam not found."}
            </p>

            <button
              onClick={loadPage}
              className="mt-5 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {/* Top navigation */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => router.push("/dashboard/exams")}
            className="w-fit text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            ← Back to Exam Master
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                router.push(`/dashboard/exams/timetable?examId=${exam.id}`)
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Timetable
            </button>

            <button
              onClick={() => router.push("/dashboard/marks")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Enter Marks
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              onClick={() => setError("")}
              className="font-bold text-red-500 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {copied && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Exam copy created successfully.
          </div>
        )}

        {/* Hero */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg font-black ring-1 ring-white/15">
                  {getInitials(exam.name)}
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                      {examTypeLabels[exam.exam_type] ||
                        exam.exam_type}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                    {exam.name}
                  </h1>

                  {exam.description && (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      {exam.description}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                    <span>
                      Academic Year:{" "}
                      <strong className="text-white">
                        {exam.academic_year || "—"}
                      </strong>
                    </span>

                    <span>
                      Term:{" "}
                      <strong className="text-white">
                        {exam.term || "—"}
                      </strong>
                    </span>

                    <span>
                      Dates:{" "}
                      <strong className="text-white">
                        {formatDate(exam.start_date)} →{" "}
                        {formatDate(exam.end_date)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                <button
                  onClick={() =>
                    router.push(`/dashboard/exams?edit=${exam.id}`)
                  }
                  disabled={isLocked}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Edit Exam
                </button>

                <button
                  onClick={copyExam}
                  disabled={actionLoading}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
                >
                  {actionLoading ? "Working..." : "Copy Exam"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid divide-y border-t border-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Result Inclusion
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {exam.include_in_result ? "Included" : "Not Included"}
              </p>
            </div>

            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Weightage
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {exam.weightage}%
              </p>
            </div>

            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Active
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {exam.is_active ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Classes
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {uniqueClassIds.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Configured for this exam
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Subject Configurations
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {examSubjects.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Class + subject combinations
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Timetable
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {schedules.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {scheduleDays} exam day
              {scheduleDays === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Total Marks
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {totalMaxMarks}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Pass threshold total: {totalPassMarks}
            </p>
          </div>
        </section>

        {/* Simple workflow */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Setup
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-900">
              Complete this exam
            </h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <WorkflowButton
              step="1"
              icon="📚"
              title="Subjects"
              onClick={() =>
                router.push(`/dashboard/exams/subjects?examId=${exam.id}`)
              }
            />
            <WorkflowButton
              step="2"
              icon="🗓️"
              title="Timetable"
              onClick={() =>
                router.push(`/dashboard/exams/timetable?examId=${exam.id}`)
              }
            />
            <WorkflowButton
              step="3"
              icon="✍️"
              title="Enter Marks"
              onClick={() => router.push(`/dashboard/marks?examId=${exam.id}`)}
            />
            <WorkflowButton
              step="4"
              icon="📊"
              title="Results"
              onClick={() => router.push(`/dashboard/results?examId=${exam.id}`)}
            />
          </div>
        </section>

        {/* Subjects */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                Configuration
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                Exam Subjects
              </h2>
            </div>

            <button
              onClick={() =>
                router.push(
                  `/dashboard/exams/subjects?examId=${exam.id}`
                )
              }
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Manage Subjects
            </button>
          </div>

          {examSubjects.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                📚
              </div>

              <h3 className="mt-4 font-bold text-slate-900">
                No subjects configured
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Add class-wise subjects before starting marks entry.
              </p>

              <button
                onClick={() =>
                  router.push(
                    `/dashboard/exams/subjects?examId=${exam.id}`
                  )
                }
                className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Configure Subjects
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Class</th>
                    <th className="px-5 py-3">Subject</th>
                    <th className="px-5 py-3">Max Marks</th>
                    <th className="px-5 py-3">Pass Marks</th>
                    <th className="px-5 py-3">Optional</th>
                    <th className="px-5 py-3">Result</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {examSubjects.map((item) => (
                    <tr
                      key={`${item.exam_id}-${item.class_id}-${item.subject_id}`}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {classLabel(item.class_id)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {subjectLabel(item.subject_id)}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {item.max_marks}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {item.pass_marks}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            item.is_optional
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.is_optional ? "Optional" : "Compulsory"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            item.include_in_result
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.include_in_result
                            ? "Included"
                            : "Excluded"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Timetable */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                Schedule
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                Upcoming Timetable
              </h2>
            </div>

            <button
              onClick={() =>
                router.push(
                  `/dashboard/exams/timetable?examId=${exam.id}`
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Manage Timetable
            </button>
          </div>

          {upcomingSchedules.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🗓️
              </div>

              <h3 className="mt-4 font-bold text-slate-900">
                No timetable entries
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Schedule subjects with exact date and time.
              </p>

              <button
                onClick={() =>
                  router.push(
                    `/dashboard/exams/timetable?examId=${exam.id}`
                  )
                }
                className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Create Timetable
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingSchedules.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                      <span className="text-[10px] font-bold uppercase">
                        {new Date(
                          `${item.exam_date}T00:00:00`
                        ).toLocaleDateString("en-IN", {
                          month: "short",
                        })}
                      </span>

                      <span className="text-lg font-black leading-none">
                        {new Date(
                          `${item.exam_date}T00:00:00`
                        ).getDate()}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900">
                        {subjectLabel(item.subject_id)}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {classLabel(item.class_id)} •{" "}
                        {formatDate(item.exam_date)}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {item.shift}
                        </span>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {formatTime(item.start_time)} –{" "}
                          {formatTime(item.end_time)}
                        </span>

                        {item.room && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            Room {item.room}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {upcomingSchedules.length > 8 && (
                <div className="p-4 text-center">
                  <button
                    onClick={() =>
                      router.push(
                        `/dashboard/exams/timetable?examId=${exam.id}`
                      )
                    }
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    View all {upcomingSchedules.length} timetable entries →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Status management */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Exam Lifecycle
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-900">
                Status: {status.label}
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Draft exams can be activated. Active exams can be locked
                after marks entry. Locked exams can be published after
                verification.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {exam.status === "DRAFT" && (
                <button
                  onClick={() => changeStatus("ACTIVE")}
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Activate Exam
                </button>
              )}

              {exam.status === "ACTIVE" && (
                <>
                  <button
                    onClick={() => changeStatus("DRAFT")}
                    disabled={actionLoading}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Move to Draft
                  </button>

                  <button
                    onClick={() => changeStatus("LOCKED")}
                    disabled={actionLoading}
                    className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Lock Exam
                  </button>
                </>
              )}

              {exam.status === "LOCKED" && (
                <button
                  onClick={() => changeStatus("PUBLISHED")}
                  disabled={actionLoading}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Publish Results
                </button>
              )}

              {exam.status === "PUBLISHED" && (
                <span className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700">
                  ✓ Results Published
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Audit info */}
        <section className="mt-6 pb-8">
          <div className="flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:justify-between">
            <span>
              Exam ID: <strong>{exam.id}</strong>
            </span>

            <span>
              Last updated: {formatDateTime(exam.updated_at)}
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}