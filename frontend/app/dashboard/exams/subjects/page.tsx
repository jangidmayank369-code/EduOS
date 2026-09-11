"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Exam = {
  id: number;
  name: string;
  description?: string | null;
  exam_type?: string;
  academic_year?: string | null;
  term?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  include_in_result?: boolean;
  weightage?: number;
  status?: string;
  is_active?: boolean;
};

type SchoolClass = {
  id: number;
  name: string;
  section?: string | null;
};

type Subject = {
  id: number;
  name: string;
  code?: string | null;
};

type ExamSubjectComponent = {
  key: string;
  name: string;
  type: string;
  max_marks: number;
  pass_marks: number;
  include_in_result: boolean;
  is_optional: boolean;
  display_order: number;
};

type ExamSubject = {
  exam_id: number;
  class_id: number;
  subject_id: number;
  max_marks: number;
  pass_marks: number;
  is_optional: boolean;
  include_in_result: boolean;
  components?: ExamSubjectComponent[];
};

type ComponentForm = {
  key: string;
  name: string;
  type: string;
  max_marks: string;
  pass_marks: string;
  include_in_result: boolean;
  is_optional: boolean;
};

type FormState = {
  class_id: string;
  subject_id: string;
  max_marks: string;
  pass_marks: string;
  is_optional: boolean;
  include_in_result: boolean;
  components: ComponentForm[];
};

const API = "http://127.0.0.1:8000";

const COMPONENT_TYPES = [
  {
    value: "THEORY",
    label: "Theory / Written",
  },
  {
    value: "PRACTICAL",
    label: "Practical",
  },
  {
    value: "ORAL",
    label: "Oral",
  },
  {
    value: "INTERNAL",
    label: "Internal",
  },
  {
    value: "PROJECT",
    label: "Project",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

const emptyForm: FormState = {
  class_id: "",
  subject_id: "",
  max_marks: "100",
  pass_marks: "40",
  is_optional: false,
  include_in_result: true,
  components: [],
};

function createEmptyComponent(
  displayOrder: number
): ComponentForm {
  return {
    key: `component_${displayOrder}`,
    name: "",
    type: "THEORY",
    max_marks: "",
    pass_marks: "",
    include_in_result: true,
    is_optional: false,
  };
}

function ExamSubjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const examId = searchParams.get("examId");

  const [exam, setExam] = useState<Exam | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] =
    useState<ExamSubject | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);

  const isLocked =
    exam?.status === "LOCKED" ||
    exam?.status === "PUBLISHED";

  useEffect(() => {
    if (!examId) {
      setError("Exam ID missing.");
      setLoading(false);
      return;
    }

    loadData();
  }, [examId]);

  // ---------------------------------------------------------
  // AUTHENTICATED API HELPER
  // ---------------------------------------------------------

  async function request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem("access_token");

    if (!token) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");

      window.location.href = "/login";

      throw new Error("Not authenticated");
    }

    const response = await fetch(`${API}${path}`, {
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

      window.location.href = "/login";

      throw new Error(
        "Session expired. Please login again."
      );
    }

    if (!response.ok) {
      let message = `Request failed (${response.status})`;

      try {
        const data = await response.json();

        if (typeof data?.detail === "string") {
          message = data.detail;
        } else if (Array.isArray(data?.detail)) {
          message = data.detail
            .map(
              (item: any) =>
                item?.msg || "Validation error"
            )
            .join(", ");
        }
      } catch {
        // Ignore invalid error body.
      }

      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ---------------------------------------------------------
  // LOAD DATA
  // ---------------------------------------------------------

  async function loadData() {
    if (!examId) return;

    setLoading(true);
    setError("");

    try {
      const [
        examData,
        classData,
        subjectData,
        configData,
      ] = await Promise.all([
        request<Exam>(`/exams/${examId}`),

        request<SchoolClass[]>(
          "/classes"
        ),

        request<Subject[]>(
          "/subjects/"
        ),

        request<ExamSubject[]>(
          `/exam-subjects/exam/${examId}`
        ),
      ]);

      setExam(examData);

      setClasses(
        Array.isArray(classData)
          ? classData
          : []
      );

      setSubjects(
        Array.isArray(subjectData)
          ? subjectData
          : []
      );

      setExamSubjects(
        Array.isArray(configData)
          ? configData
          : []
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load exam subjects."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------

  function getClassName(classId: number) {
    const item = classes.find(
      (c) => c.id === classId
    );

    if (!item) {
      return `Class #${classId}`;
    }

    return item.section
      ? `${item.name} - ${item.section}`
      : item.name;
  }

  function getSubjectName(subjectId: number) {
    const item = subjects.find(
      (s) => s.id === subjectId
    );

    if (!item) {
      return `Subject #${subjectId}`;
    }

    return item.code
      ? `${item.name} (${item.code})`
      : item.name;
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(
      `${value}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function updateForm<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function updateComponent(
    index: number,
    key: keyof ComponentForm,
    value: string | boolean
  ) {
    setForm((previous) => ({
      ...previous,
      components: previous.components.map(
        (component, componentIndex) =>
          componentIndex === index
            ? {
                ...component,
                [key]: value,
              }
            : component
      ),
    }));
  }

  function addComponent() {
    setForm((previous) => ({
      ...previous,
      components: [
        ...previous.components,
        createEmptyComponent(
          previous.components.length + 1
        ),
      ],
    }));
  }

  function removeComponent(index: number) {
    setForm((previous) => ({
      ...previous,
      components: previous.components
        .filter(
          (_, componentIndex) =>
            componentIndex !== index
        )
        .map((component, componentIndex) => ({
          ...component,
          key:
            component.key ||
            `component_${componentIndex + 1}`,
        })),
    }));
  }

  function getComponentTotal() {
    return form.components.reduce(
      (total, component) => {
        const value = Number(
          component.max_marks
        );

        return total +
          (Number.isFinite(value)
            ? value
            : 0);
      },
      0
    );
  }

  // ---------------------------------------------------------
  // FILTERED DATA
  // ---------------------------------------------------------

  const filteredRows = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return examSubjects.filter((row) => {
      if (
        classFilter &&
        String(row.class_id) !== classFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const className =
        getClassName(
          row.class_id
        ).toLowerCase();

      const subjectName =
        getSubjectName(
          row.subject_id
        ).toLowerCase();

      const componentText = (
        row.components || []
      )
        .map(
          (component) =>
            `${component.name} ${component.type}`
        )
        .join(" ")
        .toLowerCase();

      return (
        className.includes(query) ||
        subjectName.includes(query) ||
        componentText.includes(query) ||
        String(
          row.max_marks
        ).includes(query) ||
        String(
          row.pass_marks
        ).includes(query)
      );
    });
  }, [
    examSubjects,
    classFilter,
    search,
    classes,
    subjects,
  ]);

  // ---------------------------------------------------------
  // STATS
  // ---------------------------------------------------------

  const stats = useMemo(() => {
    const uniqueClasses =
      new Set(
        examSubjects.map(
          (item) => item.class_id
        )
      );

    const optional =
      examSubjects.filter(
        (item) =>
          item.is_optional
      ).length;

    const included =
      examSubjects.filter(
        (item) =>
          item.include_in_result
      ).length;

    const configuredComponents =
      examSubjects.reduce(
        (total, item) =>
          total +
          (item.components?.length || 0),
        0
      );

    return {
      total: examSubjects.length,
      classes: uniqueClasses.size,
      optional,
      included,
      components: configuredComponents,
    };
  }, [examSubjects]);

  // ---------------------------------------------------------
  // ADD
  // ---------------------------------------------------------

  function openAddModal() {
    if (isLocked) {
      alert(
        "Locked/Published exam me subject configuration change nahi kar sakte."
      );
      return;
    }

    setEditing(null);

    setForm({
      ...emptyForm,
      class_id:
        classFilter || "",
      components: [],
    });

    setError("");
    setShowModal(true);
  }

  // ---------------------------------------------------------
  // EDIT
  // ---------------------------------------------------------

  function openEditModal(
    row: ExamSubject
  ) {
    if (isLocked) {
      alert(
        "Locked/Published exam me subject configuration change nahi kar sakte."
      );
      return;
    }

    setEditing(row);

    setForm({
      class_id: String(
        row.class_id
      ),

      subject_id: String(
        row.subject_id
      ),

      max_marks: String(
        row.max_marks
      ),

      pass_marks: String(
        row.pass_marks
      ),

      is_optional:
        row.is_optional,

      include_in_result:
        row.include_in_result,

      components:
        (row.components || []).map(
          (component, index) => ({
            key:
              component.key ||
              `component_${index + 1}`,

            name:
              component.name || "",

            type:
              component.type ||
              "THEORY",

            max_marks:
              String(
                component.max_marks ??
                  ""
              ),

            pass_marks:
              String(
                component.pass_marks ??
                  ""
              ),

            include_in_result:
              component.include_in_result !==
              false,

            is_optional:
              component.is_optional ===
              true,
          })
        ),
    });

    setError("");
    setShowModal(true);
  }

  // ---------------------------------------------------------
  // CLOSE MODAL
  // ---------------------------------------------------------

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  }

  // ---------------------------------------------------------
  // VALIDATE COMPONENTS
  // ---------------------------------------------------------

  function validateComponents(
    maxMarks: number
  ): string | null {
    if (form.components.length === 0) {
      return null;
    }

    const keys = new Set<string>();

    let total = 0;

    for (
      let index = 0;
      index < form.components.length;
      index++
    ) {
      const component =
        form.components[index];

      const name =
        component.name.trim();

      if (!name) {
        return `Component ${index + 1}: name is required.`;
      }

      const key =
        component.key.trim();

      if (!key) {
        return `Component ${index + 1}: key is required.`;
      }

      if (keys.has(key)) {
        return `Duplicate component key: ${key}`;
      }

      keys.add(key);

      const componentMax =
        Number(
          component.max_marks
        );

      const componentPass =
        Number(
          component.pass_marks
        );

      if (
        !Number.isFinite(
          componentMax
        ) ||
        componentMax <= 0
      ) {
        return `${name}: max marks must be greater than zero.`;
      }

      if (
        !Number.isFinite(
          componentPass
        ) ||
        componentPass < 0
      ) {
        return `${name}: pass marks are invalid.`;
      }

      if (
        componentPass >
        componentMax
      ) {
        return `${name}: pass marks cannot exceed max marks.`;
      }

      total += componentMax;
    }

    if (
      Math.abs(
        total - maxMarks
      ) > 0.0001
    ) {
      return (
        `Component total (${total}) must equal ` +
        `subject max marks (${maxMarks}).`
      );
    }

    return null;
  }

  // ---------------------------------------------------------
  // SAVE
  // ---------------------------------------------------------

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!examId) return;

    if (isLocked) {
      alert(
        "This exam is locked/published."
      );
      return;
    }

    const classId =
      Number(form.class_id);

    const subjectId =
      Number(form.subject_id);

    const maxMarks =
      Number(form.max_marks);

    const passMarks =
      Number(form.pass_marks);

    if (!classId || !subjectId) {
      alert(
        "Class aur Subject select karo."
      );
      return;
    }

    if (
      !Number.isFinite(maxMarks) ||
      maxMarks <= 0
    ) {
      alert(
        "Max marks valid hona chahiye."
      );
      return;
    }

    if (
      !Number.isFinite(passMarks) ||
      passMarks < 0
    ) {
      alert(
        "Pass marks valid hona chahiye."
      );
      return;
    }

    if (
      passMarks > maxMarks
    ) {
      alert(
        "Pass marks max marks se zyada nahi ho sakte."
      );
      return;
    }

    const componentError =
      validateComponents(
        maxMarks
      );

    if (componentError) {
      alert(componentError);
      return;
    }

    if (!editing) {
      const duplicate =
        examSubjects.some(
          (row) =>
            row.class_id ===
              classId &&
            row.subject_id ===
              subjectId
        );

      if (duplicate) {
        alert(
          "Ye subject is class ke liye already configured hai."
        );
        return;
      }
    }

    const components =
      form.components.map(
        (component, index) => ({
          key:
            component.key.trim(),

          name:
            component.name.trim(),

          type:
            component.type,

          max_marks:
            Number(
              component.max_marks
            ),

          pass_marks:
            Number(
              component.pass_marks
            ),

          include_in_result:
            component.include_in_result,

          is_optional:
            component.is_optional,

          display_order:
            index + 1,
        })
      );

    setSaving(true);
    setError("");

    try {
      if (editing) {
        await request(
          `/exam-subjects/${editing.exam_id}/${editing.class_id}/${editing.subject_id}`,
          {
            method: "PUT",

            body: JSON.stringify({
              max_marks:
                maxMarks,

              pass_marks:
                passMarks,

              is_optional:
                form.is_optional,

              include_in_result:
                form.include_in_result,

              components,
            }),
          }
        );
      } else {
        await request(
          "/exam-subjects/",
          {
            method: "POST",

            body: JSON.stringify({
              exam_id:
                Number(examId),

              class_id:
                classId,

              subject_id:
                subjectId,

              max_marks:
                maxMarks,

              pass_marks:
                passMarks,

              is_optional:
                form.is_optional,

              include_in_result:
                form.include_in_result,

              components,
            }),
          }
        );
      }

      closeModal();

      await loadData();
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to save subject configuration."
      );
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------

  async function handleDelete(
    row: ExamSubject
  ) {
    if (isLocked) {
      alert(
        "Locked/Published exam me subject configuration delete nahi kar sakte."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Remove "${getSubjectName(
          row.subject_id
        )}" from ${getClassName(
          row.class_id
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await request(
        `/exam-subjects/${row.exam_id}/${row.class_id}/${row.subject_id}`,
        {
          method: "DELETE",
        }
      );

      await loadData();
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to delete configuration."
      );
    }
  }

  // ---------------------------------------------------------
  // MISSING EXAM ID
  // ---------------------------------------------------------

  if (!examId) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
            !
          </div>

          <h1 className="text-xl font-bold text-slate-900">
            Exam ID missing
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Exam Master se kisi exam ka
            Subjects page open karo.
          </p>

          <button
            onClick={() =>
              router.push(
                "/dashboard/exams"
              )
            }
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to Exams
          </button>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------
  // MAIN UI
  // ---------------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <button
                onClick={() =>
                  router.push(
                    "/dashboard/exams"
                  )
                }
                className="hover:text-slate-900"
              >
                Exams
              </button>

              <span>/</span>

              <span className="font-medium text-slate-700">
                Subjects
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Exam Subjects
              </h1>

              {exam && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    exam.status ===
                    "PUBLISHED"
                      ? "bg-emerald-100 text-emerald-700"
                      : exam.status ===
                        "LOCKED"
                      ? "bg-red-100 text-red-700"
                      : exam.status ===
                        "ACTIVE"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {exam.status ||
                    "DRAFT"}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Class-wise subject configuration for{" "}
              <span className="font-semibold text-slate-700">
                {exam?.name ||
                  "selected exam"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                router.push(
                  `/dashboard/exams/timetable?examId=${examId}`
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              🗓 Timetable
            </button>

            <button
              onClick={() =>
                router.push(
                  `/dashboard/marks?examId=${examId}`
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ✍ Marks
            </button>

            <button
              onClick={
                openAddModal
              }
              disabled={isLocked}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add Subject
            </button>
          </div>
        </div>

        {/* LOCK NOTICE */}

        {isLocked && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-xl">
              🔒
            </div>

            <div>
              <p className="font-semibold text-red-800">
                Exam is{" "}
                {exam?.status}
              </p>

              <p className="mt-1 text-sm text-red-700">
                Subject configuration is
                read-only while the exam
                is locked or published.
              </p>
            </div>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div>
              <p className="font-semibold text-red-800">
                Something went wrong
              </p>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>
            </div>

            <button
              onClick={() =>
                setError("")
              }
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick summary */}
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <SummaryChip label="Subjects" value={String(stats.total)} />
          <SummaryChip label="Classes" value={String(stats.classes)} />
          <SummaryChip label="Optional" value={String(stats.optional)} />
          <SummaryChip label="In Result" value={String(stats.included)} />
          <SummaryChip label="Components" value={String(stats.components)} />
        </div>

        {/* Exam context */}
        {exam && (
          <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Exam</p>
              <p className="text-sm font-bold text-slate-800">{exam.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Type</p>
              <p className="text-sm font-semibold text-slate-700">{exam.exam_type || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Year</p>
              <p className="text-sm font-semibold text-slate-700">{exam.academic_year || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Term</p>
              <p className="text-sm font-semibold text-slate-700">{exam.term || "—"}</p>
            </div>
            <div className="sm:ml-auto">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Exam Dates</p>
              <p className="text-sm font-semibold text-slate-700">
                {exam.start_date
                  ? exam.end_date
                    ? `${formatDate(exam.start_date)} - ${formatDate(exam.end_date)}`
                    : formatDate(exam.start_date)
                  : "—"}
              </p>
            </div>
          </div>
        )}

        {/* FILTERS */}

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-2 lg:grid-cols-[210px_1fr_auto]">
            <select
              value={
                classFilter
              }
              onChange={(e) =>
                setClassFilter(
                  e.target.value
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            >
              <option value="">
                All Classes
              </option>

              {classes.map(
                (item) => (
                  <option
                    key={item.id}
                    value={
                      item.id
                    }
                  >
                    {item.section
                      ? `${item.name} - ${item.section}`
                      : item.name}
                  </option>
                )
              )}
            </select>

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search class, subject, component, marks..."
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />

            <button
              onClick={() => {
                setSearch("");
                setClassFilter(
                  ""
                );
              }}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <LoadingState />
          ) : filteredRows.length ===
            0 ? (
            <EmptyState
              onAdd={
                openAddModal
              }
              disabled={
                Boolean(
                  isLocked
                )
              }
            />
          ) : (
            <>
              {/* DESKTOP */}

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Class
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Subject
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Components
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Max
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Pass
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Optional
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Result
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map(
                      (row) => (
                        <tr
                          key={`${row.exam_id}-${row.class_id}-${row.subject_id}`}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {getClassName(
                                row.class_id
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {getSubjectName(
                                row.subject_id
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {row.components &&
                            row.components.length >
                              0 ? (
                              <div className="flex max-w-[330px] flex-wrap gap-1.5">
                                {row.components.map(
                                  (
                                    component
                                  ) => (
                                    <span
                                      key={
                                        component.key
                                      }
                                      className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"
                                    >
                                      {
                                        component.name
                                      }{" "}
                                      {
                                        component.max_marks
                                      }
                                    </span>
                                  )
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                No components
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-semibold text-slate-700">
                              {
                                row.max_marks
                              }
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-semibold text-slate-700">
                              {
                                row.pass_marks
                              }
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {row.is_optional ? (
                              <Badge
                                text="Optional"
                                className="bg-amber-100 text-amber-700"
                              />
                            ) : (
                              <span className="text-sm text-slate-400">
                                No
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {row.include_in_result ? (
                              <Badge
                                text="Included"
                                className="bg-emerald-100 text-emerald-700"
                              />
                            ) : (
                              <Badge
                                text="Excluded"
                                className="bg-slate-100 text-slate-500"
                              />
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  openEditModal(
                                    row
                                  )
                                }
                                disabled={
                                  isLocked
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() =>
                                  handleDelete(
                                    row
                                  )
                                }
                                disabled={
                                  isLocked
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}

              <div className="divide-y divide-slate-100 lg:hidden">
                {filteredRows.map(
                  (row) => (
                    <div
                      key={`${row.exam_id}-${row.class_id}-${row.subject_id}`}
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {getClassName(
                              row.class_id
                            )}
                          </p>

                          <h3 className="mt-1 font-bold text-slate-900">
                            {getSubjectName(
                              row.subject_id
                            )}
                          </h3>
                        </div>

                        {row.is_optional && (
                          <Badge
                            text="Optional"
                            className="bg-amber-100 text-amber-700"
                          />
                        )}
                      </div>

                      {row.components &&
                        row.components.length >
                          0 && (
                          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-500">
                              Components
                            </p>

                            <div className="mt-2 space-y-1.5">
                              {row.components.map(
                                (
                                  component
                                ) => (
                                  <div
                                    key={
                                      component.key
                                    }
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="font-medium text-blue-900">
                                      {
                                        component.name
                                      }
                                    </span>

                                    <span className="font-bold text-blue-700">
                                      {
                                        component.max_marks
                                      }
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniInfo
                          label="Max Marks"
                          value={String(
                            row.max_marks
                          )}
                        />

                        <MiniInfo
                          label="Pass Marks"
                          value={String(
                            row.pass_marks
                          )}
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        {row.include_in_result ? (
                          <Badge
                            text="Included in Result"
                            className="bg-emerald-100 text-emerald-700"
                          />
                        ) : (
                          <Badge
                            text="Excluded from Result"
                            className="bg-slate-100 text-slate-500"
                          />
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              openEditModal(
                                row
                              )
                            }
                            disabled={
                              isLocked
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(
                                row
                              )
                            }
                            disabled={
                              isLocked
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            Showing{" "}
            {
              filteredRows.length
            }{" "}
            of{" "}
            {
              examSubjects.length
            }{" "}
            configurations
          </span>

          <span>•</span>

          <span>
            Component total must equal
            subject maximum marks.
          </span>
        </div>
      </div>

      {/* MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="my-6 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editing
                    ? "Edit Subject Configuration"
                    : "Add Exam Subject"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Configure marks, components
                  and result behaviour.
                </p>
              </div>

              <button
                onClick={
                  closeModal
                }
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
            >
              <div className="max-h-[75vh] space-y-6 overflow-y-auto p-5">

                {/* CLASS */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Class *
                  </label>

                  <select
                    value={
                      form.class_id
                    }
                    onChange={(e) =>
                      updateForm(
                        "class_id",
                        e.target.value
                      )
                    }
                    disabled={
                      Boolean(
                        editing
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100"
                    required
                  >
                    <option value="">
                      Select Class
                    </option>

                    {classes.map(
                      (item) => (
                        <option
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >
                          {item.section
                            ? `${item.name} - ${item.section}`
                            : item.name}
                        </option>
                      )
                    )}
                  </select>

                  {editing && (
                    <p className="mt-1 text-xs text-slate-400">
                      Class cannot be
                      changed while
                      editing.
                    </p>
                  )}
                </div>

                {/* SUBJECT */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Subject *
                  </label>

                  <select
                    value={
                      form.subject_id
                    }
                    onChange={(e) =>
                      updateForm(
                        "subject_id",
                        e.target.value
                      )
                    }
                    disabled={
                      Boolean(
                        editing
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100"
                    required
                  >
                    <option value="">
                      Select Subject
                    </option>

                    {subjects.map(
                      (item) => (
                        <option
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >
                          {item.code
                            ? `${item.name} (${item.code})`
                            : item.name}
                        </option>
                      )
                    )}
                  </select>

                  {editing && (
                    <p className="mt-1 text-xs text-slate-400">
                      Subject cannot be
                      changed while
                      editing.
                    </p>
                  )}
                </div>

                {/* SUBJECT MARKS */}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900">
                      Subject Marks
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Overall maximum and
                      passing marks for this
                      subject.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Maximum Marks *
                      </label>

                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={
                          form.max_marks
                        }
                        onChange={(e) =>
                          updateForm(
                            "max_marks",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Pass Marks *
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          form.pass_marks
                        }
                        onChange={(e) =>
                          updateForm(
                            "pass_marks",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* COMPONENTS */}

                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        Exam Components
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Example: Written 70 +
                        Oral 30 = 100.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        addComponent
                      }
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      + Add Component
                    </button>
                  </div>

                  {form.components.length ===
                  0 ? (
                    <div className="rounded-xl border border-dashed border-blue-200 bg-white p-5 text-center">
                      <p className="text-sm font-semibold text-slate-700">
                        No components configured
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        You can keep this
                        subject as a single
                        total-mark subject,
                        or add Written,
                        Oral, Practical,
                        Internal, etc.
                      </p>

                      <button
                        type="button"
                        onClick={
                          addComponent
                        }
                        className="mt-3 text-sm font-bold text-blue-600 hover:text-blue-700"
                      >
                        + Add first component
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {form.components.map(
                        (
                          component,
                          index
                        ) => (
                          <div
                            key={`${index}-${component.key}`}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
                                  {index +
                                    1}
                                </span>

                                <span className="text-sm font-bold text-slate-800">
                                  Component
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeComponent(
                                    index
                                  )
                                }
                                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Component Name *
                                </label>

                                <input
                                  value={
                                    component.name
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateComponent(
                                      index,
                                      "name",
                                      e.target
                                        .value
                                    )
                                  }
                                  placeholder="e.g. Written"
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                                  required
                                />
                              </div>

                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Component Type
                                </label>

                                <select
                                  value={
                                    component.type
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateComponent(
                                      index,
                                      "type",
                                      e.target
                                        .value
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                                >
                                  {COMPONENT_TYPES.map(
                                    (
                                      type
                                    ) => (
                                      <option
                                        key={
                                          type.value
                                        }
                                        value={
                                          type.value
                                        }
                                      >
                                        {
                                          type.label
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>

                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Max Marks *
                                </label>

                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={
                                    component.max_marks
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateComponent(
                                      index,
                                      "max_marks",
                                      e.target
                                        .value
                                    )
                                  }
                                  placeholder="70"
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                                  required
                                />
                              </div>

                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Pass Marks *
                                </label>

                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    component.pass_marks
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateComponent(
                                      index,
                                      "pass_marks",
                                      e.target
                                        .value
                                    )
                                  }
                                  placeholder="28"
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                                  required
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3">
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={
                                    component.include_in_result
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateComponent(
                                      index,
                                      "include_in_result",
                                      e.target
                                        .checked
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-300"
                                />

                                <span className="text-xs font-semibold text-slate-700">
                                  Include in Result
                                </span>
                              </label>

                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={
                                    component.is_optional
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateComponent(
                                      index,
                                      "is_optional",
                                      e.target
                                        .checked
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-300"
                                />

                                <span className="text-xs font-semibold text-slate-700">
                                  Optional Component
                                </span>
                              </label>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {form.components.length >
                    0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MiniInfo
                        label="Component Total"
                        value={`${getComponentTotal()} marks`}
                      />

                      <MiniInfo
                        label="Subject Maximum"
                        value={`${form.max_marks || 0} marks`}
                      />

                      <div
                        className={`rounded-xl p-3 ${
                          Math.abs(
                            getComponentTotal() -
                              Number(
                                form.max_marks ||
                                  0
                              )
                          ) <
                          0.0001
                            ? "bg-emerald-50"
                            : "bg-red-50"
                        }`}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Configuration
                        </p>

                        <p
                          className={`mt-1 text-sm font-bold ${
                            Math.abs(
                              getComponentTotal() -
                                Number(
                                  form.max_marks ||
                                    0
                                )
                            ) <
                            0.0001
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {Math.abs(
                            getComponentTotal() -
                              Number(
                                form.max_marks ||
                                  0
                              )
                          ) <
                          0.0001
                            ? "✓ Total Matches"
                            : "⚠ Total Must Match"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* OPTIONS */}

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        form.is_optional
                      }
                      onChange={(e) =>
                        updateForm(
                          "is_optional",
                          e.target.checked
                        )
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />

                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Optional Subject
                      </span>

                      <span className="mt-0.5 block text-xs text-slate-500">
                        Student may not be
                        required to take
                        this subject.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        form.include_in_result
                      }
                      onChange={(e) =>
                        updateForm(
                          "include_in_result",
                          e.target.checked
                        )
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />

                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Include in Result
                      </span>

                      <span className="mt-0.5 block text-xs text-slate-500">
                        Include this subject
                        in result
                        calculation.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* FOOTER */}

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    Boolean(
                      isLocked
                    )
                  }
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editing
                    ? "Update Configuration"
                    : "Add Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}


export default function ExamSubjectsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ExamSubjectsPageContent />
    </Suspense>
  );
}


// ---------------------------------------------------------
// UI COMPONENTS
// ---------------------------------------------------------

function SummaryChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <span className="text-sm font-black text-slate-800">{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function Badge({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {text}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />

      <p className="text-sm font-medium text-slate-600">
        Loading subject configuration...
      </p>
    </div>
  );
}

function EmptyState({
  onAdd,
  disabled,
}: {
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <div className="p-10 text-center sm:p-16">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
        📚
      </div>

      <h3 className="text-lg font-bold text-slate-900">
        No subjects configured
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Add subjects class-wise with
        maximum marks, pass marks,
        components and result settings.
      </p>

      <button
        onClick={onAdd}
        disabled={disabled}
        className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add First Subject
      </button>
    </div>
  );
}