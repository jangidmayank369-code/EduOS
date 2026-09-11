"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type Exam = {
  id: number;
  name: string;
  exam_type?: string;
  academic_year?: string | null;
  term?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
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
};

type ExamSubject = {
  exam_id: number;
  class_id: number;
  subject_id: number;
  max_marks?: number;
  pass_marks?: number;
};

type ExamSchedule = {
  id: number;
  exam_id: number;
  class_id: number;
  subject_id: number;
  exam_date: string;
  shift: "MORNING" | "AFTERNOON" | "EVENING";
  start_time: string;
  end_time: string;
  room: string | null;
  instructions: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type FormState = {
  exam_id: string;
  class_id: string;
  subject_id: string;
  exam_date: string;
  shift: "MORNING" | "AFTERNOON" | "EVENING";
  start_time: string;
  end_time: string;
  room: string;
  instructions: string;
};

const emptyForm: FormState = {
  exam_id: "",
  class_id: "",
  subject_id: "",
  exam_date: "",
  shift: "MORNING",
  start_time: "09:00",
  end_time: "10:30",
  room: "",
  instructions: "",
};

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
};

const normalizeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    "items" in value &&
    Array.isArray((value as { items: unknown }).items)
  ) {
    return (value as { items: T[] }).items;
  }

  return [];
};

const getClassName = (item: SchoolClass) =>
  item.name || item.class_name || `Class ${item.id}`;

const getSubjectName = (item: Subject) =>
  item.name || item.subject_name || `Subject ${item.id}`;

const formatDate = (dateString: string) => {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDay = (dateString: string) => {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
  });
};

const formatTime = (value: string) => {
  if (!value) return "-";

  const [hourString, minuteString] = value.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (Number.isNaN(hour)) return value;

  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 || 12;

  return `${twelveHour}:${String(minute || 0).padStart(2, "0")} ${suffix}`;
};

const shiftLabel = (shift: ExamSchedule["shift"]) => {
  if (shift === "MORNING") return "Morning";
  if (shift === "AFTERNOON") return "Afternoon";
  return "Evening";
};

const shiftClass = (shift: ExamSchedule["shift"]) => {
  if (shift === "MORNING") {
    return "bg-blue-50 text-blue-700 border-blue-100";
  }

  if (shift === "AFTERNOON") {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  return "bg-purple-50 text-purple-700 border-purple-100";
};

const isLockedExam = (exam: Exam | null) =>
  exam?.status === "LOCKED" || exam?.status === "PUBLISHED";

function ExamTimetablePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const examIdFromUrl = searchParams.get("examId");

  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  const [form, setForm] = useState<FormState>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedExam = useMemo(
    () =>
      exams.find(
        (exam) => String(exam.id) === String(selectedExamId),
      ) || null,
    [exams, selectedExamId],
  );

  const selectedClass = useMemo(
    () =>
      classes.find(
        (item) => String(item.id) === String(selectedClassId),
      ) || null,
    [classes, selectedClassId],
  );

  const timetableLocked = isLockedExam(selectedExam);

  const subjectMap = useMemo(() => {
    const map = new Map<number, string>();

    subjects.forEach((subject) => {
      map.set(subject.id, getSubjectName(subject));
    });

    return map;
  }, [subjects]);

  const classMap = useMemo(() => {
    const map = new Map<number, string>();

    classes.forEach((schoolClass) => {
      map.set(schoolClass.id, getClassName(schoolClass));
    });

    return map;
  }, [classes]);

  const availableSubjects = useMemo(() => {
    if (!form.class_id) return [];

    const configuredIds = new Set(
      examSubjects
        .filter(
          (item) =>
            String(item.class_id) === String(form.class_id),
        )
        .map((item) => item.subject_id),
    );

    return subjects.filter((subject) =>
      configuredIds.has(subject.id),
    );
  }, [examSubjects, subjects, form.class_id]);

  const filteredSchedules = useMemo(() => {
    const query = search.trim().toLowerCase();

    return schedules
      .filter((item) => {
        if (
          selectedClassId &&
          String(item.class_id) !== String(selectedClassId)
        ) {
          return false;
        }

        if (dateFilter && item.exam_date !== dateFilter) {
          return false;
        }

        if (!query) return true;

        const subjectName =
          subjectMap.get(item.subject_id) || "";

        const className =
          classMap.get(item.class_id) || "";

        return (
          subjectName.toLowerCase().includes(query) ||
          className.toLowerCase().includes(query) ||
          (item.room || "").toLowerCase().includes(query) ||
          shiftLabel(item.shift).toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const dateCompare =
          a.exam_date.localeCompare(b.exam_date);

        if (dateCompare !== 0) return dateCompare;

        return a.start_time.localeCompare(b.start_time);
      });
  }, [
    schedules,
    selectedClassId,
    dateFilter,
    search,
    subjectMap,
    classMap,
  ]);

  const groupedSchedules = useMemo(() => {
    const groups = new Map<string, ExamSchedule[]>();

    filteredSchedules.forEach((schedule) => {
      const existing = groups.get(schedule.exam_date) || [];
      existing.push(schedule);
      groups.set(schedule.exam_date, existing);
    });

    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, [filteredSchedules]);

  const totalDays = new Set(
    schedules.map((item) => item.exam_date),
  ).size;

  const morningCount = schedules.filter(
    (item) => item.shift === "MORNING",
  ).length;

  const afternoonCount = schedules.filter(
    (item) => item.shift === "AFTERNOON",
  ).length;

  const eveningCount = schedules.filter(
    (item) => item.shift === "EVENING",
  ).length;

  const apiFetch = async (
    path: string,
    options: RequestInit = {},
  ) => {
    const token = getToken();

    if (!token) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      router.push("/login");
      throw new Error("Authentication required");
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      router.push("/login");
      throw new Error("Session expired");
    }

    return response;
  };

  const readError = async (
    response: Response,
    fallback: string,
  ) => {
    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        return data.detail;
      }

      if (Array.isArray(data?.detail)) {
        return data.detail
          .map(
            (item: { msg?: string }) =>
              item.msg || "Invalid value",
          )
          .join(", ");
      }

      return fallback;
    } catch {
      return fallback;
    }
  };

  const loadMasterData = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        examResponse,
        classResponse,
        subjectResponse,
      ] = await Promise.all([
        apiFetch("/exams/"),
        apiFetch("/classes"),
        apiFetch("/subjects/"),
      ]);

      if (!examResponse.ok) {
        throw new Error(
          await readError(
            examResponse,
            "Unable to load exams.",
          ),
        );
      }

      if (!classResponse.ok) {
        throw new Error(
          await readError(
            classResponse,
            "Unable to load classes.",
          ),
        );
      }

      if (!subjectResponse.ok) {
        throw new Error(
          await readError(
            subjectResponse,
            "Unable to load subjects.",
          ),
        );
      }

      const examData = normalizeArray<Exam>(
        await examResponse.json(),
      );

      const classData = normalizeArray<SchoolClass>(
        await classResponse.json(),
      );

      const subjectData = normalizeArray<Subject>(
        await subjectResponse.json(),
      );

      setExams(examData);
      setClasses(classData);
      setSubjects(subjectData);

      if (examData.length > 0) {
        const urlExamExists = examIdFromUrl
          ? examData.some(
              (exam) =>
                String(exam.id) === String(examIdFromUrl),
            )
          : false;

        setSelectedExamId(
          urlExamExists
            ? String(examIdFromUrl)
            : String(examData[0].id),
        );
      } else {
        setSelectedExamId("");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load timetable data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadExamSubjects = async (examId: string) => {
    if (!examId) {
      setExamSubjects([]);
      return;
    }

    try {
      const response = await apiFetch(
        `/exam-subjects/exam/${examId}`,
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to load exam subjects.",
          ),
        );
      }

      const data = normalizeArray<ExamSubject>(
        await response.json(),
      );

      setExamSubjects(data);
    } catch (err) {
      setExamSubjects([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load exam subjects.",
      );
    }
  };

  const loadSchedules = async (examId: string) => {
    if (!examId) {
      setSchedules([]);
      return;
    }

    setLoadingSchedules(true);
    setError("");

    try {
      const response = await apiFetch(
        `/exam-schedules/exam/${examId}`,
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to load exam timetable.",
          ),
        );
      }

      const data = normalizeArray<ExamSchedule>(
        await response.json(),
      );

      setSchedules(data);
    } catch (err) {
      setSchedules([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load timetable.",
      );
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (!selectedExamId) {
      setExamSubjects([]);
      setSchedules([]);
      return;
    }

    loadExamSubjects(selectedExamId);
    loadSchedules(selectedExamId);

    setForm((previous) => ({
      ...previous,
      exam_id: selectedExamId,
    }));

    setSelectedClassId("");
    setDateFilter("");
    setSearch("");
  }, [selectedExamId]);

  useEffect(() => {
    if (!showForm) return;

    setForm((previous) => ({
      ...previous,
      exam_id: selectedExamId,
      class_id:
        selectedClassId || previous.class_id,
      exam_date:
        previous.exam_date ||
        selectedExam?.start_date ||
        "",
    }));
  }, [
    showForm,
    selectedExamId,
    selectedClassId,
    selectedExam,
  ]);

  const openCreate = () => {
    if (!selectedExamId) {
      setError("Please select an examination first.");
      return;
    }

    if (timetableLocked) {
      setError(
        `Exam is ${selectedExam?.status?.toLowerCase()} and its timetable cannot be modified.`,
      );
      return;
    }

    setEditingId(null);
    setError("");
    setSuccess("");

    setForm({
      ...emptyForm,
      exam_id: selectedExamId,
      class_id: selectedClassId,
      exam_date: selectedExam?.start_date || "",
    });

    setShowForm(true);
  };

  const openEdit = (schedule: ExamSchedule) => {
    if (timetableLocked) {
      setError(
        `Exam is ${selectedExam?.status?.toLowerCase()} and its timetable cannot be modified.`,
      );
      return;
    }

    setEditingId(schedule.id);
    setError("");
    setSuccess("");

    setForm({
      exam_id: String(schedule.exam_id),
      class_id: String(schedule.class_id),
      subject_id: String(schedule.subject_id),
      exam_date: schedule.exam_date,
      shift: schedule.shift,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      room: schedule.room || "",
      instructions: schedule.instructions || "",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleFormChange = (
    field: keyof FormState,
    value: string,
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleClassChange = (value: string) => {
    setForm((previous) => ({
      ...previous,
      class_id: value,
      subject_id: "",
    }));
  };

  const validateClientForm = () => {
    if (timetableLocked) {
      return `Exam is ${selectedExam?.status?.toLowerCase()} and cannot be modified.`;
    }

    if (!form.exam_id) {
      return "Please select an exam.";
    }

    if (!form.class_id) {
      return "Please select a class.";
    }

    if (!form.subject_id) {
      return "Please select a subject.";
    }

    if (!form.exam_date) {
      return "Please select exam date.";
    }

    if (!form.start_time || !form.end_time) {
      return "Please select start and end time.";
    }

    if (form.end_time <= form.start_time) {
      return "End time must be later than start time.";
    }

    if (
      selectedExam?.start_date &&
      form.exam_date < selectedExam.start_date
    ) {
      return `Exam date cannot be before ${formatDate(
        selectedExam.start_date,
      )}.`;
    }

    if (
      selectedExam?.end_date &&
      form.exam_date > selectedExam.end_date
    ) {
      return `Exam date cannot be after ${formatDate(
        selectedExam.end_date,
      )}.`;
    }

    return "";
  };

  const saveSchedule = async () => {
    setError("");
    setSuccess("");

    const validationError = validateClientForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        exam_id: Number(form.exam_id),
        class_id: Number(form.class_id),
        subject_id: Number(form.subject_id),
        exam_date: form.exam_date,
        shift: form.shift,
        start_time: `${form.start_time}:00`,
        end_time: `${form.end_time}:00`,
        room: form.room.trim() || null,
        instructions:
          form.instructions.trim() || null,
      };

      const url = editingId
        ? `/exam-schedules/${editingId}`
        : "/exam-schedules/";

      const response = await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(
          editingId
            ? {
                class_id: payload.class_id,
                subject_id: payload.subject_id,
                exam_date: payload.exam_date,
                shift: payload.shift,
                start_time: payload.start_time,
                end_time: payload.end_time,
                room: payload.room,
                instructions: payload.instructions,
              }
            : payload,
        ),
      });

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to save exam schedule.",
          ),
        );
      }

      await response.json();

      setSuccess(
        editingId
          ? "Exam timetable updated successfully."
          : "Exam timetable created successfully.",
      );

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadSchedules(selectedExamId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save exam timetable.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (
    schedule: ExamSchedule,
  ) => {
    if (timetableLocked) {
      setError(
        `Exam is ${selectedExam?.status?.toLowerCase()} and its timetable cannot be modified.`,
      );
      return;
    }

    const subjectName =
      subjectMap.get(schedule.subject_id) ||
      `Subject ${schedule.subject_id}`;

    const confirmed = window.confirm(
      `Delete ${subjectName} timetable from ${formatDate(
        schedule.exam_date,
      )}?`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/exam-schedules/${schedule.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to delete timetable.",
          ),
        );
      }

      setSuccess("Exam timetable entry removed.");
      await loadSchedules(selectedExamId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete timetable.",
      );
    }
  };

  const resetFilters = () => {
    setSelectedClassId("");
    setDateFilter("");
    setSearch("");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-5">
            <div className="h-10 w-72 rounded-xl bg-slate-200" />
            <div className="h-32 rounded-2xl bg-white" />
            <div className="h-96 rounded-2xl bg-white" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <section className="rounded-3xl bg-[#102A56] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <button
                onClick={() =>
                  router.push("/dashboard/exams")
                }
                className="mb-4 text-sm font-medium text-blue-200 transition hover:text-white"
              >
                ← Back to Exams
              </button>

              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl">
                  📅
                </span>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                    Examination Management
                  </p>

                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Exam Timetable
                  </h1>
                </div>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-blue-100">
                Manage class-wise subject schedules, exam dates,
                shifts, timings and examination rooms from one
                place.
              </p>
            </div>

            <button
              onClick={openCreate}
              disabled={
                !selectedExamId || timetableLocked
              }
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#102A56] shadow-lg transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {timetableLocked
                ? "🔒 Timetable Locked"
                : "+ Add Exam Schedule"}
            </button>
          </div>
        </section>

        {/* Locked notice */}
        {timetableLocked && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
            🔒 This examination is{" "}
            <strong>
              {selectedExam?.status}
            </strong>
            . Timetable changes are disabled.
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <div className="flex items-start justify-between gap-4">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
                className="font-bold text-red-500"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        {/* Main selectors */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Examination
              </label>

              <select
                value={selectedExamId}
                onChange={(event) =>
                  setSelectedExamId(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  Select examination
                </option>

                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                    {exam.academic_year
                      ? ` — ${exam.academic_year}`
                      : ""}
                    {exam.status
                      ? ` — ${exam.status}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Class
              </label>

              <select
                value={selectedClassId}
                onChange={(event) =>
                  setSelectedClassId(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  All Classes
                </option>

                {classes.map((schoolClass) => (
                  <option
                    key={schoolClass.id}
                    value={schoolClass.id}
                  >
                    {getClassName(schoolClass)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 lg:w-auto"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </section>

        {/* Quick summary */}
        <section className="flex flex-wrap gap-2">
          <SummaryChip label="Scheduled" value={String(schedules.length)} />
          <SummaryChip label="Days" value={String(totalDays)} />
          <SummaryChip label="Morning" value={String(morningCount)} />
          <SummaryChip label="Afternoon" value={String(afternoonCount)} />
          <SummaryChip label="Evening" value={String(eveningCount)} />
        </section>

        {/* Exam context */}
        {selectedExam && (
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Exam</p>
                <p className="text-sm font-bold text-slate-800">{selectedExam.name}</p>
              </div>
              {selectedExam.exam_type && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Type</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {selectedExam.exam_type.replaceAll("_", " ")}
                  </p>
                </div>
              )}
              {selectedExam.academic_year && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Year</p>
                  <p className="text-sm font-semibold text-slate-700">{selectedExam.academic_year}</p>
                </div>
              )}
              {selectedExam.term && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Term</p>
                  <p className="text-sm font-semibold text-slate-700">{selectedExam.term}</p>
                </div>
              )}
              {selectedExam.start_date && selectedExam.end_date && (
                <div className="sm:ml-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Exam Window</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatDate(selectedExam.start_date)} → {formatDate(selectedExam.end_date)}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Search / date filter */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search subject, class, room..."
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <input
              type="date"
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(event.target.value)
              }
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            <button
              onClick={() => setDateFilter("")}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              All Dates
            </button>
          </div>
        </section>

        {/* Timetable */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Timetable
                </h2>

                <p className="text-sm text-slate-500">
                  {selectedClass
                    ? getClassName(selectedClass)
                    : "All classes"}
                </p>
              </div>

              {loadingSchedules && (
                <span className="text-xs font-semibold text-blue-600">
                  Loading...
                </span>
              )}
            </div>
          </div>

          {filteredSchedules.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                📅
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-800">
                No timetable entries
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {selectedExam
                  ? "No exam schedule has been created for the selected filters yet."
                  : "Select an examination to manage its timetable."}
              </p>

              {selectedExam && !timetableLocked && (
                <button
                  onClick={openCreate}
                  className="mt-5 rounded-xl bg-[#102A56] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0c2144]"
                >
                  + Create First Schedule
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {groupedSchedules.map(
                ([date, daySchedules]) => (
                  <div key={date} className="p-5">
                    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                          {formatDay(date)}
                        </p>

                        <h3 className="mt-1 text-xl font-bold text-slate-900">
                          {formatDate(date)}
                        </h3>
                      </div>

                      <span className="text-xs font-semibold text-slate-400">
                        {daySchedules.length} exam
                        {daySchedules.length !== 1
                          ? "s"
                          : ""}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {daySchedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm"
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                            {/* Time */}
                            <div className="min-w-[150px]">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                Time
                              </p>

                              <p className="mt-1 text-lg font-bold text-[#102A56]">
                                {formatTime(
                                  schedule.start_time,
                                )}
                              </p>

                              <p className="text-xs font-medium text-slate-400">
                                to{" "}
                                {formatTime(
                                  schedule.end_time,
                                )}
                              </p>
                            </div>

                            {/* Subject */}
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-bold text-slate-900">
                                  {subjectMap.get(
                                    schedule.subject_id,
                                  ) ||
                                    `Subject #${schedule.subject_id}`}
                                </h4>

                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${shiftClass(
                                    schedule.shift,
                                  )}`}
                                >
                                  {shiftLabel(
                                    schedule.shift,
                                  )}
                                </span>

                                {!schedule.is_active && (
                                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                                    Inactive
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                                <span>
                                  <strong className="text-slate-700">
                                    Class:
                                  </strong>{" "}
                                  {classMap.get(
                                    schedule.class_id,
                                  ) ||
                                    `Class #${schedule.class_id}`}
                                </span>

                                <span>
                                  <strong className="text-slate-700">
                                    Room:
                                  </strong>{" "}
                                  {schedule.room ||
                                    "Not assigned"}
                                </span>
                              </div>

                              {schedule.instructions && (
                                <p className="mt-2 text-xs text-slate-500">
                                  <strong className="text-slate-700">
                                    Note:
                                  </strong>{" "}
                                  {schedule.instructions}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            {!timetableLocked && (
                              <div className="flex shrink-0 gap-2">
                                <button
                                  onClick={() =>
                                    openEdit(schedule)
                                  }
                                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() =>
                                    deleteSchedule(
                                      schedule,
                                    )
                                  }
                                  className="rounded-xl border border-red-100 px-4 py-2.5 text-xs font-bold text-red-500 transition hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">

            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  {editingId
                    ? "Edit Schedule"
                    : "New Schedule"}
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {editingId
                    ? "Update Exam Timetable"
                    : "Add Exam Schedule"}
                </h2>
              </div>

              <button
                onClick={closeForm}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-6">

              {/* Exam */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Examination
                </label>

                <select
                  value={form.exam_id}
                  disabled={Boolean(editingId)}
                  onChange={(event) =>
                    handleFormChange(
                      "exam_id",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                >
                  <option value="">
                    Select examination
                  </option>

                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class + Subject */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Class
                  </label>

                  <select
                    value={form.class_id}
                    onChange={(event) =>
                      handleClassChange(
                        event.target.value,
                      )
                    }
                    disabled={Boolean(editingId)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                  >
                    <option value="">
                      Select class
                    </option>

                    {classes.map((schoolClass) => (
                      <option
                        key={schoolClass.id}
                        value={schoolClass.id}
                      >
                        {getClassName(schoolClass)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Subject
                  </label>

                  <select
                    value={form.subject_id}
                    disabled={Boolean(editingId)}
                    onChange={(event) =>
                      handleFormChange(
                        "subject_id",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                  >
                    <option value="">
                      {form.class_id
                        ? "Select subject"
                        : "Select class first"}
                    </option>

                    {availableSubjects.map(
                      (subject) => (
                        <option
                          key={subject.id}
                          value={subject.id}
                        >
                          {getSubjectName(subject)}
                        </option>
                      ),
                    )}
                  </select>

                  {form.class_id &&
                    availableSubjects.length === 0 && (
                      <p className="mt-2 text-xs text-amber-600">
                        No subjects configured for this
                        class in this examination.
                      </p>
                    )}
                </div>
              </div>

              {/* Date + Shift */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Exam Date
                  </label>

                  <input
                    type="date"
                    value={form.exam_date}
                    min={
                      selectedExam?.start_date ||
                      undefined
                    }
                    max={
                      selectedExam?.end_date ||
                      undefined
                    }
                    onChange={(event) =>
                      handleFormChange(
                        "exam_date",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Shift
                  </label>

                  <select
                    value={form.shift}
                    onChange={(event) =>
                      handleFormChange(
                        "shift",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="MORNING">
                      Morning
                    </option>

                    <option value="AFTERNOON">
                      Afternoon
                    </option>

                    <option value="EVENING">
                      Evening
                    </option>
                  </select>
                </div>
              </div>

              {/* Time */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Start Time
                  </label>

                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(event) =>
                      handleFormChange(
                        "start_time",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    End Time
                  </label>

                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(event) =>
                      handleFormChange(
                        "end_time",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Room */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Room / Hall
                </label>

                <input
                  value={form.room}
                  onChange={(event) =>
                    handleFormChange(
                      "room",
                      event.target.value,
                    )
                  }
                  placeholder="e.g. Hall 1, Room 204"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Instructions
                </label>

                <textarea
                  value={form.instructions}
                  onChange={(event) =>
                    handleFormChange(
                      "instructions",
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="Optional exam instructions..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Preview */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                  Schedule Preview
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-blue-500">
                      Class / Subject
                    </p>

                    <p className="mt-1 text-sm font-bold text-blue-900">
                      {form.class_id
                        ? classMap.get(
                            Number(form.class_id),
                          ) || "Selected class"
                        : "Class"}
                      {" · "}
                      {form.subject_id
                        ? subjectMap.get(
                            Number(form.subject_id),
                          ) || "Selected subject"
                        : "Subject"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-blue-500">
                      Date / Shift
                    </p>

                    <p className="mt-1 text-sm font-bold text-blue-900">
                      {form.exam_date
                        ? formatDate(form.exam_date)
                        : "Date"}
                      {" · "}
                      {shiftLabel(form.shift)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-blue-500">
                      Timing
                    </p>

                    <p className="mt-1 text-sm font-bold text-blue-900">
                      {formatTime(form.start_time)}
                      {" — "}
                      {formatTime(form.end_time)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-blue-500">
                      Room
                    </p>

                    <p className="mt-1 text-sm font-bold text-blue-900">
                      {form.room || "Not assigned"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button
                onClick={closeForm}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={saveSchedule}
                disabled={saving || timetableLocked}
                className="flex-1 rounded-xl bg-[#102A56] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0c2144] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Schedule"
                    : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <span className="text-sm font-black text-[#102A56]">{value}</span>
    </div>
  );
}

export default function ExamTimetablePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-7xl">
            <div className="animate-pulse space-y-5">
              <div className="h-10 w-72 rounded-xl bg-slate-200" />
              <div className="h-32 rounded-2xl bg-white" />
              <div className="h-96 rounded-2xl bg-white" />
            </div>
          </div>
        </main>
      }
    >
      <ExamTimetablePageContent />
    </Suspense>
  );
}
