"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/* ============================================================
   TYPES
============================================================ */

type ClassItem = {
  id: number;
  name?: string;
  class_name?: string;
  grade?: string;
  section?: string;
};

type AcademicSession = {
  id: number;
  name?: string;
  session_name?: string;
  year?: string;
  is_active?: boolean;
};

type Exam = {
  id: number;
  name: string;
  exam_type?: string;
  academic_year?: string;
  term?: string;
  status?: string;
};

type ConfigExam = {
  id?: number;
  exam_id: number;
  weightage: number;
  include_in_result: boolean;
  exam?: Exam;
};

type ResultConfiguration = {
  id: number;
  name: string;
  class_id: number;
  academic_session_id?: number | null;
  term?: string | null;
  calculation_method: string;
  best_of_count?: number | null;
  status: string;
  is_active: boolean;
  published_at?: string | null;
  exams: ConfigExam[];
};

type ResultSubject = {
  subject_id: number;
  subject_name?: string;
  total_marks: number;
  max_marks: number;
  percentage: number;
  grade: string;
  is_pass: boolean;
};

type FinalResult = {
  id: number;
  configuration_id: number;
  student_id: number;
  student_name?: string;
  name?: string;
  total_marks: number;
  max_marks: number;
  percentage: number;
  grade: string;
  rank?: number | null;
  is_pass: boolean;
  is_locked: boolean;
  is_published: boolean;
  published_at?: string | null;
  subjects?: ResultSubject[];
};

type PreviewSubject = {
  subject_id: number;
  subject_name: string;
  total_marks: number;
  max_marks: number;
  percentage: number;
  grade: string;
  is_pass: boolean;
};

type PreviewResult = {
  student_id: number;
  student_name: string;
  subjects: PreviewSubject[];
  total_marks: number;
  max_marks: number;
  percentage: number;
  grade: string;
  rank?: number | null;
  is_pass: boolean;
  missing_marks: boolean;
  missing_exam_ids?: number[];
};

type Statistics = {
  total_students?: number;
  generated_students?: number;
  passed_students?: number;
  failed_students?: number;
  pass_percentage?: number;
  average_percentage?: number;
  highest_percentage?: number;
  lowest_percentage?: number;
  missing_marks_students?: number;
};

type CreateExam = {
  exam_id: number;
  weightage: number;
  include_in_result: boolean;
};

/* ============================================================
   API
============================================================ */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function api(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const token = getToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        data?.error ||
        `Request failed (${response.status})`
    );
  }

  return data;
}

/* ============================================================
   SAFE RESPONSE HELPERS
============================================================ */

function asArray<T>(
  data: any,
  keys: string[] = []
): T[] {
  if (Array.isArray(data)) {
    return data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function getClasses(data: any): ClassItem[] {
  return asArray<ClassItem>(data, [
    "classes",
    "items",
  ]);
}

function getSessions(data: any): AcademicSession[] {
  return asArray<AcademicSession>(data, [
    "sessions",
    "items",
  ]);
}

function getExams(data: any): Exam[] {
  return asArray<Exam>(data, [
    "exams",
    "items",
  ]);
}

function getConfigurations(
  data: any
): ResultConfiguration[] {
  const list = asArray<ResultConfiguration>(
    data,
    [
      "configurations",
      "results",
      "items",
      "final_results",
    ]
  );

  return list.map(normalizeConfig);
}

function normalizeConfig(
  item: any
): ResultConfiguration {
  return {
    id: Number(item?.id || 0),
    name: item?.name || "Untitled Result",
    class_id: Number(item?.class_id || 0),
    academic_session_id:
      item?.academic_session_id ?? null,
    term: item?.term ?? null,
    calculation_method:
      item?.calculation_method || "WEIGHTED",
    best_of_count:
      item?.best_of_count ?? null,
    status: item?.status || "DRAFT",
    is_active:
      item?.is_active !== false,
    published_at:
      item?.published_at ?? null,
    exams: asArray<ConfigExam>(
      item?.exams,
      []
    ).map((exam) => ({
      id: exam?.id,
      exam_id: Number(exam?.exam_id || 0),
      weightage: Number(
        exam?.weightage || 0
      ),
      include_in_result:
        exam?.include_in_result !== false,
      exam: exam?.exam,
    })),
  };
}

/*
 * IMPORTANT:
 * Backend results endpoint may return:
 *
 * [...]
 * { results: [...] }
 * { final_results: [...] }
 * { items: [...] }
 * { data: [...] }
 *
 * Never directly do setResults(response).
 */
function getResults(data: any): FinalResult[] {
  const list = asArray<FinalResult>(
    data,
    [
      "results",
      "final_results",
      "items",
    ]
  );

  return list;
}

function getSingleObject(data: any): any {
  if (!data) return null;

  if (data.preview) return data.preview;
  if (data.configuration) return data.configuration;
  if (data.data && !Array.isArray(data.data)) {
    return data.data;
  }

  return data;
}

/* ============================================================
   UI HELPERS
============================================================ */

function className(item?: ClassItem) {
  if (!item) return "Unknown Class";

  return (
    item.name ||
    item.class_name ||
    item.grade ||
    `Class ${item.id}`
  );
}

function sessionName(
  item?: AcademicSession
) {
  if (!item) return "Unknown Session";

  return (
    item.name ||
    item.session_name ||
    item.year ||
    `Session ${item.id}`
  );
}

function studentName(result: FinalResult) {
  return (
    result.student_name ||
    result.name ||
    `Student #${result.student_id}`
  );
}

function statusStyle(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700";

    case "REVIEW":
      return "bg-amber-100 text-amber-700";

    case "LOCKED":
      return "bg-blue-100 text-blue-700";

    case "PUBLISHED":
      return "bg-emerald-100 text-emerald-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatNumber(value: any) {
  const number = Number(value || 0);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : "0.00";
}

/* ============================================================
   PAGE
============================================================ */

export default function ResultsPage() {
  const [classes, setClasses] =
    useState<ClassItem[]>([]);

  const [sessions, setSessions] =
    useState<AcademicSession[]>([]);

  const [exams, setExams] =
    useState<Exam[]>([]);

  const [configurations, setConfigurations] =
    useState<ResultConfiguration[]>([]);

  const [selectedConfig, setSelectedConfig] =
    useState<ResultConfiguration | null>(null);

  const [results, setResults] =
    useState<FinalResult[]>([]);

  const [statistics, setStatistics] =
    useState<Statistics | null>(null);

  const [preview, setPreview] =
    useState<PreviewResult | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [loadingResults, setLoadingResults] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [configSearch, setConfigSearch] =
    useState("");

  const [studentSearch, setStudentSearch] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [showPreview, setShowPreview] =
    useState(false);

  const [previewStudentId, setPreviewStudentId] =
    useState("");

  const [newExamId, setNewExamId] =
    useState("");

  const [newConfig, setNewConfig] =
    useState({
      name: "",
      class_id: "",
      academic_session_id: "",
      term: "",
      calculation_method: "WEIGHTED",
      best_of_count: "2",
      exams: [] as CreateExam[],
    });

  /* ============================================================
     INITIAL LOAD
  ============================================================ */

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const [
        classesData,
        sessionsData,
        examsData,
        configsData,
      ] = await Promise.all([
        api("/classes"),
        api("/academic-sessions/"),
        api("/exams/"),
        api("/final-results/configurations"),
      ]);

      const classList =
        getClasses(classesData);

      const sessionList =
        getSessions(sessionsData);

      const examList =
        getExams(examsData);

      const configList =
        getConfigurations(configsData);

      setClasses(classList);
      setSessions(sessionList);
      setExams(examList);
      setConfigurations(configList);

      if (configList.length > 0) {
        await selectConfig(configList[0]);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load result data."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     CONFIGURATION
  ============================================================ */

  async function reloadConfigurations() {
    const data = await api(
      "/final-results/configurations"
    );

    const list =
      getConfigurations(data);

    setConfigurations(list);

    return list;
  }

  async function selectConfig(
    config: ResultConfiguration
  ) {
    const normalized =
      normalizeConfig(config);

    setSelectedConfig(normalized);
    setPreview(null);
    setStatistics(null);
    setStudentSearch("");

    if (
      normalized.status === "REVIEW" ||
      normalized.status === "LOCKED" ||
      normalized.status === "PUBLISHED"
    ) {
      await loadResults(normalized.id);
      await loadStatistics(normalized.id);
    } else {
      setResults([]);
    }
  }

  /* ============================================================
     RESULTS
  ============================================================ */

  async function loadResults(
    configurationId: number
  ) {
    try {
      setLoadingResults(true);

      const data = await api(
        `/final-results/configurations/${configurationId}/results`
      );

      /*
       * FIX:
       * Always normalize response before state.
       */
      const safeResults =
        getResults(data);

      setResults(
        Array.isArray(safeResults)
          ? safeResults
          : []
      );

      return safeResults;
    } catch (err: any) {
      setResults([]);

      setError(
        err?.message ||
          "Failed to load generated results."
      );

      return [];
    } finally {
      setLoadingResults(false);
    }
  }

  async function loadStatistics(
    configurationId: number
  ) {
    try {
      const data = await api(
        `/final-results/configurations/${configurationId}/statistics`
      );

      const stats =
        data?.statistics ||
        data?.data ||
        data;

      setStatistics(
        stats && typeof stats === "object"
          ? stats
          : null
      );
    } catch {
      setStatistics(null);
    }
  }

  /* ============================================================
     CREATE CONFIGURATION
  ============================================================ */

  function resetCreateForm() {
    setNewConfig({
      name: "",
      class_id: "",
      academic_session_id: "",
      term: "",
      calculation_method: "WEIGHTED",
      best_of_count: "2",
      exams: [],
    });

    setNewExamId("");
  }

  async function createConfig() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!newConfig.name.trim()) {
        throw new Error(
          "Result configuration name is required."
        );
      }

      if (!newConfig.class_id) {
        throw new Error(
          "Please select a class."
        );
      }

      if (newConfig.exams.length === 0) {
        throw new Error(
          "Please select at least one exam."
        );
      }

      const payload = {
        name: newConfig.name.trim(),

        class_id: Number(
          newConfig.class_id
        ),

        academic_session_id:
          newConfig.academic_session_id
            ? Number(
                newConfig.academic_session_id
              )
            : null,

        term:
          newConfig.term.trim() ||
          null,

        calculation_method:
          newConfig.calculation_method,

        best_of_count:
          newConfig.calculation_method ===
          "BEST_OF"
            ? Number(
                newConfig.best_of_count
              )
            : null,

        exams: newConfig.exams,
      };

      const response = await api(
        "/final-results/configurations",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const created =
        response?.configuration ||
        response?.data ||
        response;

      setShowCreate(false);

      resetCreateForm();

      const list =
        await reloadConfigurations();

      if (created?.id) {
        const fresh =
          list.find(
            (item) =>
              item.id ===
              Number(created.id)
          );

        if (fresh) {
          await selectConfig(fresh);
        }
      }

      setSuccess(
        "Result configuration created successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to create result configuration."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     CREATE FORM EXAMS
  ============================================================ */

  function addCreateExam() {
    if (!newExamId) return;

    const id = Number(newExamId);

    if (
      newConfig.exams.some(
        (item) =>
          item.exam_id === id
      )
    ) {
      return;
    }

    setNewConfig((current) => ({
      ...current,
      exams: [
        ...current.exams,
        {
          exam_id: id,
          weightage: 0,
          include_in_result: true,
        },
      ],
    }));

    setNewExamId("");
  }

  function removeCreateExam(
    examId: number
  ) {
    setNewConfig((current) => ({
      ...current,
      exams: current.exams.filter(
        (item) =>
          item.exam_id !== examId
      ),
    }));
  }

  function updateWeightage(
    examId: number,
    value: number
  ) {
    setNewConfig((current) => ({
      ...current,
      exams: current.exams.map(
        (item) =>
          item.exam_id === examId
            ? {
                ...item,
                weightage: value,
              }
            : item
      ),
    }));
  }

  /* ============================================================
     EXISTING CONFIG EXAMS
  ============================================================ */

  async function addExamToConfig(
    examId: number
  ) {
    if (!selectedConfig) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/final-results/configurations/${selectedConfig.id}/exams`,
        {
          method: "POST",
          body: JSON.stringify({
            exam_id: examId,
            weightage: 0,
            include_in_result: true,
          }),
        }
      );

      const list =
        await reloadConfigurations();

      const fresh =
        list.find(
          (item) =>
            item.id ===
            selectedConfig.id
        );

      if (fresh) {
        setSelectedConfig(fresh);
      }

      setSuccess(
        "Exam added successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to add exam."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeExam(
    examId: number
  ) {
    if (!selectedConfig) return;

    if (
      !window.confirm(
        "Remove this exam from the result configuration?"
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/final-results/configurations/${selectedConfig.id}/exams/${examId}`,
        {
          method: "DELETE",
        }
      );

      const list =
        await reloadConfigurations();

      const fresh =
        list.find(
          (item) =>
            item.id ===
            selectedConfig.id
        );

      if (fresh) {
        setSelectedConfig(fresh);
      }

      setSuccess(
        "Exam removed successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to remove exam."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     GENERATE
  ============================================================ */

  async function generateResults() {
    if (!selectedConfig) return;

    const exams =
      Array.isArray(selectedConfig.exams)
        ? selectedConfig.exams
        : [];

    if (exams.length === 0) {
      setError(
        "Please add exams before generating results."
      );
      return;
    }

    if (
      !window.confirm(
        "Generate final results now?"
      )
    ) {
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setSuccess("");
      setResults([]);

      await api(
        `/final-results/configurations/${selectedConfig.id}/generate`,
        {
          method: "POST",
        }
      );

      const list =
        await reloadConfigurations();

      const fresh =
        list.find(
          (item) =>
            item.id ===
            selectedConfig.id
        );

      if (fresh) {
        setSelectedConfig(fresh);

        if (
          fresh.status === "REVIEW" ||
          fresh.status === "LOCKED" ||
          fresh.status === "PUBLISHED"
        ) {
          await loadResults(
            fresh.id
          );

          await loadStatistics(
            fresh.id
          );
        }
      } else {
        await loadResults(
          selectedConfig.id
        );

        await loadStatistics(
          selectedConfig.id
        );
      }

      setSuccess(
        "Final results generated successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Result generation failed."
      );
    } finally {
      setGenerating(false);
    }
  }

  /* ============================================================
     WORKFLOW
  ============================================================ */

  async function workflow(
    action:
      | "review"
      | "lock"
      | "publish"
      | "unlock"
  ) {
    if (!selectedConfig) return;

    const label =
      action === "review"
        ? "move to review"
        : action;

    if (
      !window.confirm(
        `Are you sure you want to ${label} this result?`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/final-results/configurations/${selectedConfig.id}/${action}`,
        {
          method: "POST",
        }
      );

      const list =
        await reloadConfigurations();

      const fresh =
        list.find(
          (item) =>
            item.id ===
            selectedConfig.id
        );

      if (fresh) {
        setSelectedConfig(fresh);

        if (
          fresh.status === "REVIEW" ||
          fresh.status === "LOCKED" ||
          fresh.status === "PUBLISHED"
        ) {
          await loadResults(
            fresh.id
          );

          await loadStatistics(
            fresh.id
          );
        }
      }

      setSuccess(
        `Result successfully ${label}.`
      );
    } catch (err: any) {
      setError(
        err?.message ||
          `Failed to ${label} result.`
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     RANK
  ============================================================ */

  async function recalculateRanks() {
    if (!selectedConfig) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/final-results/configurations/${selectedConfig.id}/recalculate-ranks`,
        {
          method: "POST",
        }
      );

      await loadResults(
        selectedConfig.id
      );

      await loadStatistics(
        selectedConfig.id
      );

      setSuccess(
        "Ranks recalculated successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to recalculate ranks."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     PREVIEW
  ============================================================ */

  async function previewStudent() {
    if (!selectedConfig) return;

    const id = Number(
      previewStudentId
    );

    if (
      !previewStudentId ||
      !Number.isFinite(id)
    ) {
      setError(
        "Enter a valid student ID."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response =
        await api(
          `/final-results/configurations/${selectedConfig.id}/preview/${id}`
        );

      const data =
        getSingleObject(response);

      setPreview(data);
      setShowPreview(true);
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to generate preview."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     SAFE RESULTS
  ============================================================ */

  const safeResults =
    Array.isArray(results)
      ? results
      : [];

  const filteredResults =
    useMemo(() => {
      const query =
        studentSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return safeResults;
      }

      return safeResults.filter(
        (result) => {
          const name =
            studentName(result)
              .toLowerCase();

          const id =
            String(
              result.student_id
            );

          const rank =
            String(
              result.rank ?? ""
            );

          return (
            name.includes(query) ||
            id.includes(query) ||
            rank.includes(query)
          );
        }
      );
    }, [safeResults, studentSearch]);

  const localStats = useMemo(() => {
    const total =
      safeResults.length;

    const passed =
      safeResults.filter(
        (item) => item.is_pass
      ).length;

    const failed =
      total - passed;

    const average =
      total > 0
        ? safeResults.reduce(
            (sum, item) =>
              sum +
              Number(
                item.percentage || 0
              ),
            0
          ) / total
        : 0;

    return {
      total,
      passed,
      failed,
      average,
    };
  }, [safeResults]);

  const filteredConfigurations =
    useMemo(() => {
      const query =
        configSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return configurations;
      }

      return configurations.filter(
        (item) =>
          item.name
            .toLowerCase()
            .includes(query)
      );
    }, [
      configurations,
      configSearch,
    ]);

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border bg-white">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

              <p className="mt-3 text-sm text-slate-500">
                Loading results...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     MAIN UI
  ============================================================ */

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1500px] p-3 sm:p-4 lg:p-5">

        {/* HEADER */}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">
                RESULTS
              </span>

              <span className="text-xs text-slate-500">
                Final Result Management
              </span>
            </div>

            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Results
            </h1>

            <p className="text-xs text-slate-500">
              Configure, generate, verify and publish final results.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setShowCreate(true);
            }}
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Create Result
          </button>
        </div>

        {/* ALERTS */}

        {error && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <div className="min-w-0">
              <p className="font-semibold">
                Error
              </p>

              <p className="mt-0.5 break-words text-xs">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0 text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <div>
              <p className="font-semibold">
                Success
              </p>

              <p className="mt-0.5 text-xs">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* MAIN GRID */}

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">

          {/* CONFIGURATION SIDEBAR */}

          <aside className="h-fit overflow-hidden rounded-xl border bg-white shadow-sm lg:sticky lg:top-4">
            <div className="border-b p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Configurations
                  </h2>

                  <p className="text-[11px] text-slate-500">
                    {configurations.length} total
                  </p>
                </div>

                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                  {configurations.length}
                </span>
              </div>

              <input
                value={configSearch}
                onChange={(e) =>
                  setConfigSearch(
                    e.target.value
                  )
                }
                placeholder="Search..."
                className="mt-3 w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-slate-500"
              />
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-2">
              {filteredConfigurations.length ===
              0 ? (
                <div className="rounded-lg border border-dashed p-5 text-center">
                  <div className="text-2xl">
                    📊
                  </div>

                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    No configurations
                  </p>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Create your first result.
                  </p>
                </div>
              ) : (
                filteredConfigurations.map(
                  (config) => {
                    const active =
                      selectedConfig?.id ===
                      config.id;

                    const cls =
                      classes.find(
                        (item) =>
                          item.id ===
                          config.class_id
                      );

                    const configExams =
                      Array.isArray(
                        config.exams
                      )
                        ? config.exams
                        : [];

                    return (
                      <button
                        key={config.id}
                        type="button"
                        onClick={() =>
                          selectConfig(
                            config
                          )
                        }
                        className={`mb-1.5 w-full rounded-lg border p-3 text-left transition ${
                          active
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900">
                              {config.name}
                            </p>

                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                              {className(cls)}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusStyle(
                              config.status
                            )}`}
                          >
                            {config.status}
                          </span>
                        </div>

                        <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                          <span>
                            {config.calculation_method}
                          </span>

                          <span>
                            {configExams.length} exams
                          </span>
                        </div>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </aside>

          {/* CONTENT */}

          <main className="min-w-0">
            {!selectedConfig ? (
              <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
                <div className="text-4xl">
                  📋
                </div>

                <h2 className="mt-3 text-base font-bold text-slate-800">
                  Select a result configuration
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Select one from the left or create a new result.
                </p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* CONFIG HEADER */}

                <section className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                          {selectedConfig.name}
                        </h2>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle(
                            selectedConfig.status
                          )}`}
                        >
                          {selectedConfig.status}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span>
                          Class:{" "}
                          <b className="text-slate-700">
                            {className(
                              classes.find(
                                (item) =>
                                  item.id ===
                                  selectedConfig.class_id
                              )
                            )}
                          </b>
                        </span>

                        <span>
                          Session:{" "}
                          <b className="text-slate-700">
                            {sessionName(
                              sessions.find(
                                (item) =>
                                  item.id ===
                                  selectedConfig.academic_session_id
                              )
                            )}
                          </b>
                        </span>

                        <span>
                          Method:{" "}
                          <b className="text-slate-700">
                            {selectedConfig.calculation_method}
                          </b>
                        </span>

                        {selectedConfig.term && (
                          <span>
                            Term:{" "}
                            <b className="text-slate-700">
                              {selectedConfig.term}
                            </b>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {selectedConfig.status ===
                        "DRAFT" && (
                        <button
                          type="button"
                          disabled={generating}
                          onClick={
                            generateResults
                          }
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {generating
                            ? "Generating..."
                            : "Generate"}
                        </button>
                      )}

                      {selectedConfig.status ===
                        "REVIEW" && (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={
                              recalculateRanks
                            }
                            className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Recalculate Rank
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              workflow("lock")
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Lock
                          </button>
                        </>
                      )}

                      {selectedConfig.status ===
                        "LOCKED" && (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              workflow(
                                "unlock"
                              )
                            }
                            className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Unlock
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              workflow(
                                "publish"
                              )
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Publish
                          </button>
                        </>
                      )}

                      {selectedConfig.status ===
                        "PUBLISHED" && (
                        <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                          ✓ Published
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                {/* INCLUDED EXAMS */}

                <section className="rounded-xl border bg-white shadow-sm">
                  <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Included Exams
                      </h3>

                      <p className="text-[11px] text-slate-500">
                        Assessments used for calculation
                      </p>
                    </div>

                    {selectedConfig.status ===
                      "DRAFT" && (
                      <select
                        value=""
                        disabled={saving}
                        onChange={(e) => {
                          const value =
                            e.target.value;

                          if (value) {
                            addExamToConfig(
                              Number(value)
                            );
                          }
                        }}
                        className="w-full rounded-lg border px-3 py-2 text-xs sm:w-auto"
                      >
                        <option value="">
                          + Add Exam
                        </option>

                        {exams
                          .filter(
                            (exam) =>
                              !selectedConfig.exams.some(
                                (item) =>
                                  item.exam_id ===
                                  exam.id
                              )
                          )
                          .map((exam) => (
                            <option
                              key={exam.id}
                              value={exam.id}
                            >
                              {exam.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  <div className="p-3">
                    {(
                      Array.isArray(
                        selectedConfig.exams
                      )
                        ? selectedConfig.exams
                        : []
                    ).length === 0 ? (
                      <div className="rounded-lg border border-dashed p-5 text-center">
                        <p className="text-xs font-semibold text-slate-700">
                          No exams selected
                        </p>

                        <p className="mt-1 text-[11px] text-slate-500">
                          Add exams before generating.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {selectedConfig.exams.map(
                          (item) => {
                            const exam =
                              exams.find(
                                (e) =>
                                  e.id ===
                                  item.exam_id
                              ) ||
                              item.exam;

                            return (
                              <div
                                key={
                                  item.id ||
                                  item.exam_id
                                }
                                className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-slate-50/60 p-2.5"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-slate-800">
                                    {exam?.name ||
                                      `Exam #${item.exam_id}`}
                                  </p>

                                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                                    {exam?.exam_type ||
                                      "Assessment"}
                                  </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                                    {item.weightage}%
                                  </span>

                                  {selectedConfig.status ===
                                    "DRAFT" && (
                                    <button
                                      type="button"
                                      disabled={
                                        saving
                                      }
                                      onClick={() =>
                                        removeExam(
                                          item.exam_id
                                        )
                                      }
                                      className="rounded-md px-1.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* STATS */}

                <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-medium text-slate-500">
                      Students
                    </p>

                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {statistics?.total_students ??
                        localStats.total}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-medium text-slate-500">
                      Passed
                    </p>

                    <p className="mt-1 text-xl font-bold text-emerald-600">
                      {statistics?.passed_students ??
                        localStats.passed}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-medium text-slate-500">
                      Failed
                    </p>

                    <p className="mt-1 text-xl font-bold text-red-600">
                      {statistics?.failed_students ??
                        localStats.failed}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-medium text-slate-500">
                      Average
                    </p>

                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {formatNumber(
                        statistics?.average_percentage ??
                          localStats.average
                      )}
                      %
                    </p>
                  </div>
                </section>

                {/* PREVIEW */}

                <section className="rounded-xl border bg-white p-3 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Student Preview
                      </label>

                      <input
                        type="number"
                        value={
                          previewStudentId
                        }
                        onChange={(e) =>
                          setPreviewStudentId(
                            e.target.value
                          )
                        }
                        placeholder="Enter student ID"
                        className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-slate-500"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={
                        saving ||
                        selectedConfig.status ===
                          "DRAFT"
                      }
                      onClick={
                        previewStudent
                      }
                      className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Preview
                    </button>
                  </div>
                </section>

                {/* RESULTS TABLE */}

                <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
                  <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Generated Results
                      </h3>

                      <p className="text-[11px] text-slate-500">
                        {safeResults.length} result
                        {safeResults.length === 1
                          ? ""
                          : "s"} available
                      </p>
                    </div>

                    <input
                      value={
                        studentSearch
                      }
                      onChange={(e) =>
                        setStudentSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search student..."
                      className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-slate-500 sm:w-52"
                    />
                  </div>

                  {loadingResults ? (
                    <div className="p-10 text-center">
                      <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

                      <p className="mt-2 text-xs text-slate-500">
                        Loading results...
                      </p>
                    </div>
                  ) : safeResults.length ===
                    0 ? (
                    <div className="p-10 text-center">
                      <div className="text-3xl">
                        📊
                      </div>

                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        No generated results
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Generate results after adding exams.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2.5">
                              Rank
                            </th>

                            <th className="px-3 py-2.5">
                              Student
                            </th>

                            <th className="px-3 py-2.5">
                              Total
                            </th>

                            <th className="px-3 py-2.5">
                              %
                            </th>

                            <th className="px-3 py-2.5">
                              Grade
                            </th>

                            <th className="px-3 py-2.5">
                              Result
                            </th>

                            <th className="px-3 py-2.5">
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredResults.map(
                            (result) => (
                              <tr
                                key={
                                  result.id
                                }
                                className="border-t transition hover:bg-slate-50"
                              >
                                <td className="px-3 py-3 font-bold text-slate-800">
                                  {result.rank ??
                                    "-"}
                                </td>

                                <td className="px-3 py-3">
                                  <p className="font-semibold text-slate-800">
                                    {studentName(
                                      result
                                    )}
                                  </p>

                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    ID:{" "}
                                    {
                                      result.student_id
                                    }
                                  </p>
                                </td>

                                <td className="px-3 py-3">
                                  <span className="font-semibold">
                                    {formatNumber(
                                      result.total_marks
                                    )}
                                  </span>

                                  <span className="text-slate-400">
                                    {" "}
                                    /{" "}
                                    {
                                      result.max_marks
                                    }
                                  </span>
                                </td>

                                <td className="px-3 py-3 font-bold">
                                  {formatNumber(
                                    result.percentage
                                  )}
                                  %
                                </td>

                                <td className="px-3 py-3">
                                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                                    {result.grade ||
                                      "-"}
                                  </span>
                                </td>

                                <td className="px-3 py-3">
                                  <span
                                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                      result.is_pass
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {result.is_pass
                                      ? "PASS"
                                      : "FAIL"}
                                  </span>
                                </td>

                                <td className="px-3 py-3">
                                  {result.is_published ? (
                                    <span className="font-semibold text-emerald-600">
                                      Published
                                    </span>
                                  ) : result.is_locked ? (
                                    <span className="font-semibold text-blue-600">
                                      Locked
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">
                                      Draft
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ============================================================
          CREATE RESULT MODAL
      ============================================================ */}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Create Result
                </h2>

                <p className="text-[11px] text-slate-500">
                  Configure final result calculation.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreate(false)
                }
                className="rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">

                {/* NAME */}

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Result Name
                  </label>

                  <input
                    value={newConfig.name}
                    onChange={(e) =>
                      setNewConfig(
                        (current) => ({
                          ...current,
                          name: e.target.value,
                        })
                      )
                    }
                    placeholder="Annual Result 2025-26"
                    className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-slate-500"
                  />
                </div>

                {/* CLASS */}

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Class
                  </label>

                  <select
                    value={
                      newConfig.class_id
                    }
                    onChange={(e) =>
                      setNewConfig(
                        (current) => ({
                          ...current,
                          class_id:
                            e.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 text-xs"
                  >
                    <option value="">
                      Select Class
                    </option>

                    {classes.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {className(item)}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* SESSION */}

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Academic Session
                  </label>

                  <select
                    value={
                      newConfig.academic_session_id
                    }
                    onChange={(e) =>
                      setNewConfig(
                        (current) => ({
                          ...current,
                          academic_session_id:
                            e.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 text-xs"
                  >
                    <option value="">
                      Select Session
                    </option>

                    {sessions.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {sessionName(
                            item
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* TERM */}

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Term
                  </label>

                  <input
                    value={newConfig.term}
                    onChange={(e) =>
                      setNewConfig(
                        (current) => ({
                          ...current,
                          term: e.target.value,
                        })
                      )
                    }
                    placeholder="Annual / Term 1"
                    className="w-full rounded-lg border px-3 py-2 text-xs"
                  />
                </div>

                {/* METHOD */}

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Calculation
                  </label>

                  <select
                    value={
                      newConfig.calculation_method
                    }
                    onChange={(e) =>
                      setNewConfig(
                        (current) => ({
                          ...current,
                          calculation_method:
                            e.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 text-xs"
                  >
                    <option value="WEIGHTED">
                      Weighted
                    </option>

                    <option value="AVERAGE">
                      Average
                    </option>

                    <option value="BEST_OF">
                      Best Of
                    </option>
                  </select>
                </div>

                {/* BEST OF */}

                {newConfig.calculation_method ===
                  "BEST_OF" && (
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Best Of Count
                    </label>

                    <input
                      type="number"
                      min={1}
                      value={
                        newConfig.best_of_count
                      }
                      onChange={(e) =>
                        setNewConfig(
                          (current) => ({
                            ...current,
                            best_of_count:
                              e.target.value,
                          })
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* EXAMS */}

              <div className="mt-4 rounded-lg border bg-slate-50 p-3">
                <div className="mb-2">
                  <h3 className="text-xs font-bold text-slate-800">
                    Included Exams
                  </h3>

                  <p className="text-[10px] text-slate-500">
                    Select exams used in final calculation.
                  </p>
                </div>

                <div className="flex gap-2">
                  <select
                    value={newExamId}
                    onChange={(e) =>
                      setNewExamId(
                        e.target.value
                      )
                    }
                    className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-xs"
                  >
                    <option value="">
                      Select Exam
                    </option>

                    {exams
                      .filter(
                        (exam) =>
                          !newConfig.exams.some(
                            (item) =>
                              item.exam_id ===
                              exam.id
                          )
                      )
                      .map((exam) => (
                        <option
                          key={exam.id}
                          value={exam.id}
                        >
                          {exam.name}
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    onClick={
                      addCreateExam
                    }
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-2 space-y-1.5">
                  {newConfig.exams.length ===
                  0 ? (
                    <div className="rounded-lg border border-dashed bg-white p-4 text-center text-[10px] text-slate-500">
                      No exams selected.
                    </div>
                  ) : (
                    newConfig.exams.map(
                      (item) => {
                        const exam =
                          exams.find(
                            (e) =>
                              e.id ===
                              item.exam_id
                          );

                        return (
                          <div
                            key={
                              item.exam_id
                            }
                            className="flex items-center gap-2 rounded-lg border bg-white p-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-800">
                                {exam?.name ||
                                  `Exam #${item.exam_id}`}
                              </p>

                              <p className="text-[10px] text-slate-500">
                                {exam?.exam_type ||
                                  "Assessment"}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={
                                  item.weightage
                                }
                                onChange={(e) =>
                                  updateWeightage(
                                    item.exam_id,
                                    Number(
                                      e.target.value
                                    )
                                  )
                                }
                                className="w-16 rounded-md border px-2 py-1.5 text-center text-xs"
                              />

                              <span className="text-xs text-slate-500">
                                %
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  removeCreateExam(
                                    item.exam_id
                                  )
                                }
                                className="rounded-md px-2 py-1 text-sm font-bold text-red-600 hover:bg-red-50"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      }
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={() =>
                  setShowCreate(false)
                }
                className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={
                  createConfig
                }
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create Result"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          PREVIEW MODAL
      ============================================================ */}

      {showPreview && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">
                  Result Preview
                </h2>

                <p className="truncate text-[11px] text-slate-500">
                  {preview.student_name}
                  {" • "}
                  Student ID{" "}
                  {preview.student_id}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPreview(false)
                }
                className="rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(92vh-60px)] overflow-y-auto p-4">

              {preview.missing_marks && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <b>Missing marks detected.</b>

                  {Array.isArray(
                    preview.missing_exam_ids
                  ) &&
                    preview
                      .missing_exam_ids
                      .length > 0 && (
                      <span>
                        {" "}
                        Missing exams:{" "}
                        {preview.missing_exam_ids.join(
                          ", "
                        )}
                      </span>
                    )}
                </div>
              )}

              {/* PREVIEW STATS */}

              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] text-slate-500">
                    Total
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {preview.total_marks}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] text-slate-500">
                    Max
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {preview.max_marks}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] text-slate-500">
                    Percentage
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {formatNumber(
                      preview.percentage
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] text-slate-500">
                    Grade
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {preview.grade ||
                      "-"}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] text-slate-500">
                    Result
                  </p>

                  <p
                    className={`mt-1 text-lg font-bold ${
                      preview.is_pass
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {preview.is_pass
                      ? "PASS"
                      : "FAIL"}
                  </p>
                </div>
              </div>

              {/* SUBJECTS */}

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">
                        Subject
                      </th>

                      <th className="px-3 py-2.5">
                        Marks
                      </th>

                      <th className="px-3 py-2.5">
                        Max
                      </th>

                      <th className="px-3 py-2.5">
                        %
                      </th>

                      <th className="px-3 py-2.5">
                        Grade
                      </th>

                      <th className="px-3 py-2.5">
                        Result
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(
                      Array.isArray(
                        preview.subjects
                      )
                        ? preview.subjects
                        : []
                    ).map(
                      (subject) => (
                        <tr
                          key={
                            subject.subject_id
                          }
                          className="border-t"
                        >
                          <td className="px-3 py-2.5 font-semibold text-slate-800">
                            {
                              subject.subject_name
                            }
                          </td>

                          <td className="px-3 py-2.5">
                            {
                              subject.total_marks
                            }
                          </td>

                          <td className="px-3 py-2.5">
                            {
                              subject.max_marks
                            }
                          </td>

                          <td className="px-3 py-2.5 font-semibold">
                            {formatNumber(
                              subject.percentage
                            )}
                            %
                          </td>

                          <td className="px-3 py-2.5 font-bold">
                            {
                              subject.grade
                            }
                          </td>

                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                subject.is_pass
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {subject.is_pass
                                ? "PASS"
                                : "FAIL"}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}