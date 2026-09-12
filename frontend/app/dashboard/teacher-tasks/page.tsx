"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Teacher = {
  id: number;
  employee_number?: string | null;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

type TeacherTask = {
  id: number;
  teacher_id: number;
  assigned_by_user_id: number;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  status: string;
  progress_percent: number;
  due_date: string | null;
  started_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: number | null;
  teacher_remarks: string | null;
  admin_remarks: string | null;
  created_at: string;
  updated_at: string;
};

type TaskForm = {
  teacher_id: string;
  title: string;
  description: string;
  task_type: string;
  priority: string;
  due_date: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

const TASK_TYPES = [
  "GENERAL",
  "ACADEMIC",
  "ADMINISTRATIVE",
  "EVENT",
  "STUDENT_SUPPORT",
  "EXAM",
  "OTHER",
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const STATUS_FILTERS = [
  "ALL",
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
  "REWORK",
  "APPROVED",
  "CLOSED",
  "CANCELLED",
];

function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("access_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    : {
        "Content-Type": "application/json",
      };
}

function teacherName(teacher: Teacher | undefined): string {
  if (!teacher) {
    return "Unknown teacher";
  }

  return `${teacher.first_name} ${teacher.last_name}`.trim();
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "detail" in data &&
    typeof data.detail === "string"
  ) {
    return data.detail;
  }

  return fallback;
}

function initialForm(): TaskForm {
  return {
    teacher_id: "",
    title: "",
    description: "",
    task_type: "GENERAL",
    priority: "MEDIUM",
    due_date: "",
  };
}

export default function TeacherTasksPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [tasks, setTasks] = useState<TeacherTask[]>([]);
  const [form, setForm] = useState<TaskForm>(initialForm);
  const [filterTeacher, setFilterTeacher] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingReview, setSavingReview] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [reviewTask, setReviewTask] = useState<TeacherTask | null>(null);
  const [reviewStatus, setReviewStatus] = useState("APPROVED");
  const [reviewRemarks, setReviewRemarks] = useState("");

  async function fetchTeachers(): Promise<void> {
    const response = await fetch(
      `${API_BASE}/teachers/`,
      {
        headers: authHeaders(),
      },
    );

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      throw new Error("Session expired.");
    }

    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          "Failed to load teachers.",
        ),
      );
    }

    setTeachers(
      Array.isArray(data)
        ? (data as Teacher[])
        : [],
    );
  }

  async function fetchTasks(): Promise<void> {
    const params = new URLSearchParams();

    if (filterTeacher !== "ALL") {
      params.set(
        "teacher_id",
        filterTeacher,
      );
    }

    if (filterStatus !== "ALL") {
      params.set(
        "task_status",
        filterStatus,
      );
    }

    const query = params.toString();

    const response = await fetch(
      `${API_BASE}/teacher-tasks/${query ? `?${query}` : ""}`,
      {
        headers: authHeaders(),
      },
    );

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      throw new Error("Session expired.");
    }

    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          "Failed to load teacher tasks.",
        ),
      );
    }

    setTasks(
      Array.isArray(data)
        ? (data as TeacherTask[])
        : [],
    );
  }

  async function loadPage(): Promise<void> {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        fetchTeachers(),
        fetchTasks(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load teacher task data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    void fetchTasks().catch((err: unknown) => {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to refresh tasks.",
      );
    });
  }, [filterTeacher, filterStatus]);

  const teacherMap = useMemo(
    () =>
      new Map(
        teachers.map((teacher) => [
          teacher.id,
          teacher,
        ]),
      ),
    [teachers],
  );

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tasks;
    }

    return tasks.filter((task) => {
      const teacher = teacherMap.get(
        task.teacher_id,
      );

      const haystack = [
        task.title,
        task.description ?? "",
        task.task_type,
        task.priority,
        task.status,
        teacherName(teacher),
        teacher?.employee_number ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [search, tasks, teacherMap]);

  const counts = useMemo(() => {
    return {
      total: tasks.length,
      assigned: tasks.filter(
        (task) => task.status === "ASSIGNED",
      ).length,
      active: tasks.filter(
        (task) =>
          task.status === "IN_PROGRESS" ||
          task.status === "REWORK",
      ).length,
      submitted: tasks.filter(
        (task) => task.status === "SUBMITTED",
      ).length,
      completed: tasks.filter(
        (task) =>
          task.status === "APPROVED" ||
          task.status === "CLOSED",
      ).length,
    };
  }, [tasks]);

  const handleCreate = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!form.teacher_id) {
        throw new Error(
          "Please select a teacher.",
        );
      }

      if (!form.title.trim()) {
        throw new Error(
          "Task title is required.",
        );
      }

      const response = await fetch(
        `${API_BASE}/teacher-tasks/`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            teacher_id: Number(form.teacher_id),
            title: form.title.trim(),
            description:
              form.description.trim() || null,
            task_type: form.task_type,
            priority: form.priority,
            due_date:
              form.due_date || null,
          }),
        },
      );

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        throw new Error("Session expired.");
      }

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Failed to assign task.",
          ),
        );
      }

      const newTask =
        data as TeacherTask;

      setTasks((current) => [
        newTask,
        ...current,
      ]);

      setForm(initialForm());
      setSuccess(
        "Task assigned successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to assign task.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openReview = (
    task: TeacherTask,
  ): void => {
    setReviewTask(task);
    setReviewStatus(
      task.status === "SUBMITTED"
        ? "APPROVED"
        : task.status === "REWORK"
          ? "APPROVED"
          : task.status,
    );
    setReviewRemarks(
      task.admin_remarks ?? "",
    );
    setError("");
    setSuccess("");
  };

  const handleReview = async (): Promise<void> => {
    if (!reviewTask) {
      return;
    }

    setSavingReview(reviewTask.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_BASE}/teacher-tasks/${reviewTask.id}/review`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            status: reviewStatus,
            admin_remarks:
              reviewRemarks.trim() || null,
          }),
        },
      );

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        throw new Error("Session expired.");
      }

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Failed to review task.",
          ),
        );
      }

      const updated =
        data as TeacherTask;

      setTasks((current) =>
        current.map((task) =>
          task.id === updated.id
            ? updated
            : task,
        ),
      );

      setReviewTask(null);
      setSuccess(
        "Task review updated successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to review task.",
      );
    } finally {
      setSavingReview(null);
    }
  };

  const handleCancel = async (
    task: TeacherTask,
  ): Promise<void> => {
    if (
      !window.confirm(
        `Cancel task "${task.title}"?`,
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_BASE}/teacher-tasks/${task.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Failed to cancel task.",
          ),
        );
      }

      const updated =
        data as TeacherTask;

      setTasks((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item,
        ),
      );

      setSuccess(
        "Task cancelled successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to cancel task.",
      );
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl animate-pulse space-y-6">
          <div className="h-10 w-72 rounded bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="h-24 rounded-2xl bg-slate-200"
                />
              ),
            )}
          </div>
          <div className="h-96 rounded-2xl bg-slate-200" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Admin Control
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Teacher Tasks
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Assign, monitor and review work
              delegated to teachers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadPage()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Total", counts.total],
            ["Assigned", counts.assigned],
            ["Active", counts.active],
            ["Submitted", counts.submitted],
            ["Completed", counts.completed],
          ].map(([label, count]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {count}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={handleCreate}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Assign New Task
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Only Admin can create or assign teacher tasks.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Teacher
                </span>
                <select
                  value={form.teacher_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      teacher_id:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  required
                >
                  <option value="">
                    Select teacher
                  </option>
                  {teachers
                    .filter(
                      (teacher) =>
                        teacher.is_active,
                    )
                    .map((teacher) => (
                      <option
                        key={teacher.id}
                        value={teacher.id}
                      >
                        {teacherName(teacher)}
                        {teacher.employee_number
                          ? ` · ${teacher.employee_number}`
                          : ""}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Task title
                </span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title:
                        event.target.value,
                    }))
                  }
                  maxLength={200}
                  placeholder="e.g. Prepare Unit Test"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }))
                  }
                  rows={4}
                  maxLength={10000}
                  placeholder="Task details..."
                  className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Type
                  </span>
                  <select
                    value={form.task_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        task_type:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    {TASK_TYPES.map(
                      (type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {type.replaceAll(
                            "_",
                            " ",
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Priority
                  </span>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    {PRIORITIES.map(
                      (priority) => (
                        <option
                          key={priority}
                          value={priority}
                        >
                          {priority}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Due date
                </span>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      due_date:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Assigning..."
                  : "Assign Task"}
              </button>
            </div>
          </form>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Task Register
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review teacher progress and submitted work.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={filterTeacher}
                    onChange={(event) =>
                      setFilterTeacher(
                        event.target.value,
                      )
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="ALL">
                      All teachers
                    </option>
                    {teachers.map(
                      (teacher) => (
                        <option
                          key={teacher.id}
                          value={teacher.id}
                        >
                          {teacherName(teacher)}
                        </option>
                      ),
                    )}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(event) =>
                      setFilterStatus(
                        event.target.value,
                      )
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {STATUS_FILTERS.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status === "ALL"
                            ? "All statuses"
                            : status.replaceAll(
                                "_",
                                " ",
                              )}
                        </option>
                      ),
                    )}
                  </select>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search tasks..."
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Task",
                      "Teacher",
                      "Priority",
                      "Due",
                      "Progress",
                      "Status",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleTasks.map(
                    (task) => {
                      const teacher =
                        teacherMap.get(
                          task.teacher_id,
                        );

                      return (
                        <tr
                          key={task.id}
                          className="align-top"
                        >
                          <td className="max-w-xs px-4 py-4">
                            <p className="font-semibold text-slate-900">
                              {task.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {task.description ||
                                "No description"}
                            </p>
                            <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              {task.task_type.replaceAll(
                                "_",
                                " ",
                              )}
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <p className="text-sm font-medium text-slate-800">
                              {teacherName(
                                teacher,
                              )}
                            </p>
                            {teacher?.employee_number && (
                              <p className="mt-1 text-xs text-slate-500">
                                {teacher.employee_number}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                task.priority ===
                                "URGENT"
                                  ? "bg-red-100 text-red-700"
                                  : task.priority ===
                                      "HIGH"
                                    ? "bg-orange-100 text-orange-700"
                                    : task.priority ===
                                        "LOW"
                                      ? "bg-slate-100 text-slate-600"
                                      : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {task.priority}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                            {formatDate(
                              task.due_date,
                            )}
                          </td>

                          <td className="min-w-36 px-4 py-4">
                            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                              <span>
                                {task.progress_percent}%
                              </span>
                              <span>
                                {task.status}
                              </span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-slate-800 transition-all"
                                style={{
                                  width: `${task.progress_percent}%`,
                                }}
                              />
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                task.status ===
                                "APPROVED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : task.status ===
                                      "SUBMITTED"
                                    ? "bg-violet-100 text-violet-700"
                                    : task.status ===
                                        "REWORK"
                                      ? "bg-amber-100 text-amber-700"
                                      : task.status ===
                                          "CANCELLED"
                                        ? "bg-red-100 text-red-700"
                                        : task.status ===
                                            "CLOSED"
                                          ? "bg-slate-200 text-slate-700"
                                          : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {task.status.replaceAll(
                                "_",
                                " ",
                              )}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openReview(
                                    task,
                                  )
                                }
                                disabled={
                                  task.status ===
                                    "CANCELLED" ||
                                  task.status ===
                                    "CLOSED"
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Review
                              </button>

                              {task.status !==
                                "CANCELLED" &&
                                task.status !==
                                  "CLOSED" &&
                                task.status !==
                                  "APPROVED" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCancel(
                                        task,
                                      )
                                    }
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                                  >
                                    Cancel
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}

                  {visibleTasks.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-sm text-slate-500"
                      >
                        No teacher tasks found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        {reviewTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Review Task
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  {reviewTask.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {teacherName(
                    teacherMap.get(
                      reviewTask.teacher_id,
                    ),
                  )}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Decision
                  </label>
                  <select
                    value={reviewStatus}
                    onChange={(event) =>
                      setReviewStatus(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="APPROVED">
                      Approve
                    </option>
                    <option value="REWORK">
                      Send for rework
                    </option>
                    <option value="CLOSED">
                      Close
                    </option>
                    <option value="CANCELLED">
                      Cancel
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Admin remarks
                  </label>
                  <textarea
                    value={reviewRemarks}
                    onChange={(event) =>
                      setReviewRemarks(
                        event.target.value,
                      )
                    }
                    rows={5}
                    maxLength={10000}
                    placeholder="Feedback for the teacher..."
                    className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">
                      Teacher progress
                    </span>
                    <span className="font-semibold text-slate-800">
                      {reviewTask.progress_percent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-800"
                      style={{
                        width: `${reviewTask.progress_percent}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setReviewTask(null)
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleReview()
                  }
                  disabled={
                    savingReview ===
                    reviewTask.id
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingReview ===
                  reviewTask.id
                    ? "Saving..."
                    : "Save Review"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
