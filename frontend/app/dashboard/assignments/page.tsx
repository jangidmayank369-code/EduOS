"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

type Role = "admin" | "teacher" | "student" | "parent";

type AnyObject = Record<string, any>;

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
};

type Assignment = {
  id: number;
  title?: string;
  name?: string;
  description?: string | null;
  class_id?: number;
  due_date?: string | null;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_active?: boolean;
  [key: string]: any;
};

type Submission = {
  id: number;
  assignment_id?: number;
  student_id?: number;
  content?: string | null;
  answer?: string | null;
  submission_text?: string | null;
  submitted_at?: string | null;
  marks?: number | null;
  marks_obtained?: number | null;
  score?: number | null;
  feedback?: string | null;
  graded_at?: string | null;
  [key: string]: any;
};

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || "";
}

async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.detail
        ? data.detail
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

function normalizeList(data: any): AnyObject[] {
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.assignments)) return data.assignments;
    if (Array.isArray(data.submissions)) return data.submissions;
    if (Array.isArray(data.data)) return data.data;
  }

  return [];
}

function formatDate(value?: string | null) {
  if (!value) return "No due date";

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

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAssignmentTitle(assignment: Assignment) {
  return assignment.title || assignment.name || "Untitled Assignment";
}

function getSubmissionText(submission: Submission) {
  return (
    submission.content ||
    submission.answer ||
    submission.submission_text ||
    ""
  );
}

function getSubmissionMarks(submission: Submission) {
  if (submission.marks !== undefined && submission.marks !== null) {
    return submission.marks;
  }

  if (
    submission.marks_obtained !== undefined &&
    submission.marks_obtained !== null
  ) {
    return submission.marks_obtained;
  }

  if (submission.score !== undefined && submission.score !== null) {
    return submission.score;
  }

  return null;
}

function isPastDue(date?: string | null) {
  if (!date) return false;

  const due = new Date(date);

  if (Number.isNaN(due.getTime())) return false;

  return due.getTime() < Date.now();
}

export default function AssignmentsPage() {
  const [role, setRole] = useState<Role>("student");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);

  const [parentStudentId, setParentStudentId] = useState("");

  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [gradeLoading, setGradeLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "upcoming" | "overdue"
  >("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    class_id: "",
    due_date: "",
  });

  const [submissionContent, setSubmissionContent] = useState("");

  const [gradeForm, setGradeForm] = useState({
    marks: "",
    feedback: "",
  });

  useEffect(() => {
    const savedRole = localStorage.getItem("user_role") as Role | null;

    if (
      savedRole === "admin" ||
      savedRole === "teacher" ||
      savedRole === "student" ||
      savedRole === "parent"
    ) {
      setRole(savedRole);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [role]);

  useEffect(() => {
    if (role === "teacher") {
      loadClasses();
    }
  }, [role]);

  const loadClasses = async () => {
    try {
      const data = await apiRequest("/classes/");
      setClasses(normalizeList(data) as SchoolClass[]);
    } catch {
      // Class loading error is surfaced only when teacher opens create form.
    }
  };

  const loadAssignments = async () => {
    setLoading(true);
    setError("");

    try {
      let endpoint = "/assignments/";

      if (role === "student") {
        endpoint = "/assignments/me";
      }

      const data = await apiRequest(endpoint);
      setAssignments(normalizeList(data) as Assignment[]);
    } catch (err: any) {
      setError(err?.message || "Failed to load assignments");
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadParentAssignments = async () => {
    const studentId = Number(parentStudentId);

    if (!studentId) {
      setError("Please enter a valid student ID.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        `/assignments/me/children/${studentId}`,
      );

      setAssignments(normalizeList(data) as Assignment[]);
    } catch (err: any) {
      setError(err?.message || "Failed to load child assignments");
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const title = getAssignmentTitle(assignment).toLowerCase();
      const description = String(
        assignment.description || "",
      ).toLowerCase();

      const matchesSearch =
        !query ||
        title.includes(query) ||
        description.includes(query) ||
        String(assignment.class_id || "").includes(query);

      const overdue = isPastDue(assignment.due_date);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "overdue" && overdue) ||
        (statusFilter === "upcoming" && !overdue);

      return matchesSearch && matchesStatus;
    });
  }, [assignments, search, statusFilter]);

  const stats = useMemo(() => {
    const overdue = assignments.filter((item) =>
      isPastDue(item.due_date),
    ).length;

    return {
      total: assignments.length,
      upcoming: assignments.length - overdue,
      overdue,
    };
  }, [assignments]);

  const getClassName = (classId?: number) => {
    if (!classId) return "Class not specified";

    return (
      classes.find((item) => item.id === classId)?.name ||
      `Class #${classId}`
    );
  };

  const handleCreateAssignment = async () => {
    if (!createForm.title.trim()) {
      setError("Assignment title is required.");
      return;
    }

    if (!createForm.class_id) {
      setError("Please select a class.");
      return;
    }

    if (!createForm.due_date) {
      setError("Please select a due date.");
      return;
    }

    setCreateLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/assignments/", {
        method: "POST",
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim(),
          class_id: Number(createForm.class_id),
          due_date: createForm.due_date,
        }),
      });

      setSuccess("Assignment created successfully.");

      setCreateForm({
        title: "",
        description: "",
        class_id: "",
        due_date: "",
      });

      setShowCreateModal(false);

      await loadAssignments();
    } catch (err: any) {
      setError(err?.message || "Failed to create assignment.");
    } finally {
      setCreateLoading(false);
    }
  };

  const openAssignment = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowDetailModal(true);
    setError("");
    setSuccess("");
    setMySubmission(null);
    setSubmissions([]);

    if (role === "teacher") {
      await loadSubmissions(assignment.id);
    }

    if (role === "student") {
      await loadMySubmission(assignment.id);
    }
  };

  const loadSubmissions = async (assignmentId: number) => {
    setSubmissionsLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        `/assignment-submissions/assignment/${assignmentId}`,
      );

      setSubmissions(normalizeList(data) as Submission[]);
    } catch (err: any) {
      setError(err?.message || "Failed to load submissions.");
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const loadMySubmission = async (assignmentId: number) => {
    try {
      const data = await apiRequest(
        `/assignment-submissions/me/${assignmentId}`,
      );

      if (data && typeof data === "object") {
        setMySubmission(data as Submission);
      } else {
        setMySubmission(null);
      }
    } catch {
      setMySubmission(null);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment) return;

    if (!submissionContent.trim()) {
      setError("Please write your submission before submitting.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to submit this assignment?",
    );

    if (!confirmed) return;

    setSubmitLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/assignment-submissions/", {
        method: "POST",
        body: JSON.stringify({
          assignment_id: selectedAssignment.id,
          content: submissionContent.trim(),
        }),
      });

      setSuccess("Assignment submitted successfully.");
      setSubmissionContent("");
      setShowSubmitModal(false);

      await loadMySubmission(selectedAssignment.id);
    } catch (err: any) {
      setError(err?.message || "Failed to submit assignment.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGradeSubmission = async (submission: Submission) => {
    if (!submission.id) return;

    if (!gradeForm.marks.trim()) {
      setError("Please enter marks.");
      return;
    }

    const marks = Number(gradeForm.marks);

    if (Number.isNaN(marks)) {
      setError("Marks must be a valid number.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to grade this submission?",
    );

    if (!confirmed) return;

    setGradeLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(`/assignment-submissions/${submission.id}`, {
        method: "PUT",
        body: JSON.stringify({
          marks,
          feedback: gradeForm.feedback.trim(),
        }),
      });

      setSuccess("Submission graded successfully.");

      setGradeForm({
        marks: "",
        feedback: "",
      });

      if (selectedAssignment) {
        await loadSubmissions(selectedAssignment.id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to grade submission.");
    } finally {
      setGradeLoading(false);
    }
  };

  const closeAllModals = () => {
    setShowCreateModal(false);
    setShowDetailModal(false);
    setShowSubmitModal(false);
    setSelectedAssignment(null);
  };

  const pageTitle =
    role === "student"
      ? "My Assignments"
      : role === "parent"
        ? "Child Assignments"
        : "Assignments";

  const pageSubtitle =
    role === "teacher"
      ? "Create assignments, track submissions and grade student work."
      : role === "parent"
        ? "Stay updated with your child's assignments and deadlines."
        : "Stay on top of your academic work and submissions.";

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Academic Workspace
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              {pageTitle}
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              {pageSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadAssignments}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-[#102A56]"
            >
              ↻ Refresh
            </button>

            {role === "teacher" && (
              <button
                onClick={() => {
                  setError("");
                  setShowCreateModal(true);
                }}
                className="rounded-xl bg-[#102A56] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#0b2145]"
              >
                + Create Assignment
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-0.5">{error}</p>
            </div>

            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div>
              <p className="font-semibold">Success</p>
              <p className="mt-0.5">{success}</p>
            </div>

            <button
              onClick={() => setSuccess("")}
              className="text-emerald-400 hover:text-emerald-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Parent child selector */}
        {role === "parent" && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Student ID
                </label>

                <input
                  value={parentStudentId}
                  onChange={(e) => setParentStudentId(e.target.value)}
                  type="number"
                  placeholder="Enter child student ID"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <button
                onClick={loadParentAssignments}
                className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b2145]"
              >
                Load Child Assignments
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total Assignments"
            value={stats.total}
            icon="□"
            description="Available in workspace"
          />

          <StatCard
            label="Upcoming"
            value={stats.upcoming}
            icon="◷"
            description="Still within deadline"
          />

          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon="!"
            description="Past the due date"
            danger={stats.overdue > 0}
          />
        </div>

        {/* Filters */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assignments..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1">
              {[
                ["all", "All"],
                ["upcoming", "Upcoming"],
                ["overdue", "Overdue"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() =>
                    setStatusFilter(
                      value as "all" | "upcoming" | "overdue",
                    )
                  }
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    statusFilter === value
                      ? "bg-white text-[#102A56] shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Assignment list */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#102A56]">
                  Assignment List
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {filteredAssignments.length} assignment
                  {filteredAssignments.length === 1 ? "" : "s"} shown
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl border border-slate-100 p-5"
                >
                  <div className="mb-4 h-10 w-10 rounded-xl bg-slate-100" />
                  <div className="mb-2 h-4 w-3/4 rounded bg-slate-100" />
                  <div className="mb-5 h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                □
              </div>

              <h3 className="font-semibold text-slate-700">
                No assignments found
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
                {search
                  ? "Try changing your search or filter."
                  : role === "teacher"
                    ? "Create your first assignment to get started."
                    : "There are currently no assignments available."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredAssignments.map((assignment) => {
                const overdue = isPastDue(assignment.due_date);

                return (
                  <button
                    key={assignment.id}
                    onClick={() => openAssignment(assignment)}
                    className="group text-left"
                  >
                    <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/50">
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-[#102A56]">
                          A
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            overdue
                              ? "bg-red-50 text-red-600"
                              : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {overdue ? "Overdue" : "Upcoming"}
                        </span>
                      </div>

                      <h3 className="line-clamp-2 font-bold text-[#102A56]">
                        {getAssignmentTitle(assignment)}
                      </h3>

                      <p className="mt-2 line-clamp-3 min-h-[60px] text-sm leading-5 text-slate-500">
                        {assignment.description ||
                          "No description provided for this assignment."}
                      </p>

                      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-400">Class</span>
                          <span className="font-semibold text-slate-700">
                            {getClassName(assignment.class_id)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-400">Due date</span>
                          <span
                            className={`font-semibold ${
                              overdue
                                ? "text-red-600"
                                : "text-slate-700"
                            }`}
                          >
                            {formatDate(assignment.due_date)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-blue-600">
                        <span>
                          {role === "teacher"
                            ? "View submissions"
                            : "View assignment"}
                        </span>
                        <span className="transition group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <Modal
          title="Create Assignment"
          subtitle="Publish a new assignment for a class."
          onClose={closeAllModals}
        >
          <div className="space-y-4">
            <FormField label="Assignment Title" required>
              <input
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="e.g. Mathematics Chapter 4"
                className="input"
              />
            </FormField>

            <FormField label="Class" required>
              <select
                value={createForm.class_id}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    class_id: e.target.value,
                  }))
                }
                className="input"
              >
                <option value="">Select class</option>

                {classes
                  .filter((item) => item.is_active !== false)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </FormField>

            <FormField label="Due Date" required>
              <input
                type="date"
                value={createForm.due_date}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    due_date: e.target.value,
                  }))
                }
                className="input"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe the assignment..."
                rows={5}
                className="input resize-none"
              />
            </FormField>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                onClick={closeAllModals}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateAssignment}
                disabled={createLoading}
                className="rounded-xl bg-[#102A56] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createLoading ? "Creating..." : "Create Assignment"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assignment Detail Modal */}
      {showDetailModal && selectedAssignment && (
        <Modal
          title={getAssignmentTitle(selectedAssignment)}
          subtitle={`Assignment #${selectedAssignment.id}`}
          onClose={closeAllModals}
          wide
        >
          <div className="space-y-5">
            {/* Assignment info */}
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard
                label="Class"
                value={getClassName(selectedAssignment.class_id)}
              />

              <InfoCard
                label="Due Date"
                value={formatDate(selectedAssignment.due_date)}
              />

              <InfoCard
                label="Status"
                value={
                  isPastDue(selectedAssignment.due_date)
                    ? "Overdue"
                    : "Upcoming"
                }
                danger={isPastDue(selectedAssignment.due_date)}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Description
              </p>

              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {selectedAssignment.description ||
                  "No description provided."}
              </p>
            </div>

            {/* Student */}
            {role === "student" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-[#102A56]">
                      My Submission
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      Track your submission and grade.
                    </p>
                  </div>

                  {!mySubmission && (
                    <button
                      onClick={() => {
                        setSubmissionContent("");
                        setShowSubmitModal(true);
                      }}
                      className="rounded-xl bg-[#102A56] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Submit Assignment
                    </button>
                  )}
                </div>

                {mySubmission ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Submitted
                      </p>

                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {getSubmissionText(mySubmission) ||
                          "No submission text available."}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <InfoCard
                        label="Submitted At"
                        value={formatDateTime(
                          mySubmission.submitted_at,
                        )}
                      />

                      <InfoCard
                        label="Marks"
                        value={
                          getSubmissionMarks(mySubmission) !== null
                            ? String(getSubmissionMarks(mySubmission))
                            : "Not graded"
                        }
                      />

                      <InfoCard
                        label="Graded At"
                        value={formatDateTime(
                          mySubmission.graded_at,
                        )}
                      />
                    </div>

                    {mySubmission.feedback && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-500">
                          Teacher Feedback
                        </p>

                        <p className="text-sm leading-6 text-blue-900">
                          {mySubmission.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                    <p className="font-semibold text-slate-600">
                      You haven't submitted this assignment yet.
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Submit your work before the deadline.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Teacher submissions */}
            {role === "teacher" && (
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="font-bold text-[#102A56]">
                    Student Submissions
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    Review and grade submissions for this assignment.
                  </p>
                </div>

                {submissionsLoading ? (
                  <div className="p-8 text-center text-sm text-slate-400">
                    Loading submissions...
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="font-semibold text-slate-600">
                      No submissions yet
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Student submissions will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {submissions.map((submission) => {
                      const marks = getSubmissionMarks(submission);

                      return (
                        <div
                          key={submission.id}
                          className="p-5"
                        >
                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold text-[#102A56]">
                                Student #
                                {submission.student_id ?? "—"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                Submitted{" "}
                                {formatDateTime(
                                  submission.submitted_at,
                                )}
                              </p>
                            </div>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                marks !== null
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {marks !== null
                                ? `Graded: ${marks}`
                                : "Pending grading"}
                            </span>
                          </div>

                          <div className="mb-4 rounded-xl bg-slate-50 p-4">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                              Submission
                            </p>

                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {getSubmissionText(submission) ||
                                "No submission content available."}
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[140px_1fr_auto]">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                gradeForm.marks &&
                                gradeForm.marks !== ""
                                  ? gradeForm.marks
                                  : marks !== null
                                    ? String(marks)
                                    : ""
                              }
                              onChange={(e) =>
                                setGradeForm((prev) => ({
                                  ...prev,
                                  marks: e.target.value,
                                }))
                              }
                              placeholder="Marks"
                              className="input"
                            />

                            <input
                              value={gradeForm.feedback}
                              onChange={(e) =>
                                setGradeForm((prev) => ({
                                  ...prev,
                                  feedback: e.target.value,
                                }))
                              }
                              placeholder="Feedback for student"
                              className="input"
                            />

                            <button
                              onClick={() =>
                                handleGradeSubmission(submission)
                              }
                              disabled={gradeLoading}
                              className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {gradeLoading ? "Saving..." : "Save Grade"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={closeAllModals}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Submit Assignment Modal */}
      {showSubmitModal && selectedAssignment && (
        <Modal
          title="Submit Assignment"
          subtitle={getAssignmentTitle(selectedAssignment)}
          onClose={() => setShowSubmitModal(false)}
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold">
                Due: {formatDate(selectedAssignment.due_date)}
              </p>

              {isPastDue(selectedAssignment.due_date) && (
                <p className="mt-1 text-xs text-red-600">
                  This assignment is past its due date.
                </p>
              )}
            </div>

            <FormField label="Your Submission" required>
              <textarea
                value={submissionContent}
                onChange={(e) =>
                  setSubmissionContent(e.target.value)
                }
                rows={9}
                placeholder="Write your answer or submission..."
                className="input resize-none"
              />
            </FormField>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmitAssignment}
                disabled={submitLoading}
                className="rounded-xl bg-[#102A56] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitLoading ? "Submitting..." : "Submit Assignment"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: rgb(30 41 59);
          outline: none;
          transition: all 150ms ease;
        }

        .input:focus {
          border-color: rgb(96 165 250);
          background: white;
          box-shadow: 0 0 0 4px rgb(239 246 255);
        }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  description,
  danger = false,
}: {
  label: string;
  value: number;
  icon: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${
              danger ? "text-red-600" : "text-[#102A56]"
            }`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
            danger
              ? "bg-red-50 text-red-600"
              : "bg-blue-50 text-[#102A56]"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {children}
    </div>
  );
}

function InfoCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-bold ${
          danger ? "text-red-600" : "text-slate-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-5">
      <div
        className={`max-h-[92vh] w-full overflow-hidden rounded-3xl bg-white shadow-2xl ${
          wide ? "max-w-5xl" : "max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-bold text-[#102A56]">{title}</h2>

            {subtitle && (
              <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(92vh-80px)] overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}