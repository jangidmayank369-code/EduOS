"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = "http://127.0.0.1:8000";

type Exam = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ExamForm = {
  name: string;
  description: string;
  is_active: boolean;
};

const emptyForm: ExamForm = {
  name: "",
  description: "",
  is_active: true,
};

export default function ExamsPage() {
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);

  const [form, setForm] = useState<ExamForm>(emptyForm);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const authHeaders: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [success]);

  const fetchExams = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/exams/`, {
        headers: authHeaders,
      });

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch exams");
      }

      const data: Exam[] = await response.json();
      setExams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch exams");
    } finally {
      setLoading(false);
    }
  };

  const fetchExamById = async (examId: number) => {
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/exams/${examId}`, {
        headers: authHeaders,
      });

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        window.location.href = "/login";
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch exam details");
      }

      const data: Exam = await response.json();
      return data;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch exam details"
      );
      return null;
    }
  };

  const handleViewExam = async (exam: Exam) => {
    const freshExam = await fetchExamById(exam.id);

    if (freshExam) {
      setSelectedExam(freshExam);
      setShowViewModal(true);
    }
  };

  const openCreateModal = () => {
    setEditingExam(null);
    setForm(emptyForm);
    setError("");
    setShowFormModal(true);
  };

  const openEditModal = (exam: Exam) => {
    setEditingExam(exam);

    setForm({
      name: exam.name,
      description: exam.description || "",
      is_active: exam.is_active,
    });

    setError("");
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    if (saving) return;

    setShowFormModal(false);
    setEditingExam(null);
    setForm(emptyForm);
  };

  const handleFormChange = (
    field: keyof ExamForm,
    value: string | boolean
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSaveExam = async (event: React.FormEvent) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Exam name is required");
      return;
    }

    setSaving(true);

    try {
      const isEditing = Boolean(editingExam);

      const url = isEditing
        ? `${API_BASE_URL}/exams/${editingExam!.id}`
        : `${API_BASE_URL}/exams/`;

      const method = isEditing ? "PUT" : "POST";

      const body = isEditing
        ? {
            name: form.name.trim(),
            description: form.description.trim() || null,
            is_active: form.is_active,
          }
        : {
            name: form.name.trim(),
            description: form.description.trim() || null,
          };

      const response = await fetch(url, {
        method,
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        let message = isEditing
          ? "Failed to update exam"
          : "Failed to create exam";

        try {
          const data = await response.json();

          if (typeof data?.detail === "string") {
            message = data.detail;
          }
        } catch {
          // Keep default error message.
        }

        throw new Error(message);
      }

      const savedExam: Exam = await response.json();

      if (isEditing) {
        setExams((previous) =>
          previous.map((exam) =>
            exam.id === savedExam.id ? savedExam : exam
          )
        );

        setSuccess("Exam updated successfully");
      } else {
        setExams((previous) => [savedExam, ...previous]);
        setSuccess("Exam created successfully");
      }

      setShowFormModal(false);
      setEditingExam(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (exam: Exam) => {
    setDeletingExam(exam);
    setError("");
    setShowDeleteModal(true);
  };

  const handleDeleteExam = async () => {
    if (!deletingExam) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/exams/${deletingExam.id}`,
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        let message = "Failed to delete exam";

        try {
          const data = await response.json();

          if (typeof data?.detail === "string") {
            message = data.detail;
          }
        } catch {
          // Keep default error message.
        }

        throw new Error(message);
      }

      setExams((previous) =>
        previous.filter((exam) => exam.id !== deletingExam.id)
      );

      setSuccess("Exam deleted successfully");
      setShowDeleteModal(false);
      setDeletingExam(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete exam");
    } finally {
      setDeleting(false);
    }
  };

  const filteredExams = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return exams.filter((exam) => {
      const matchesSearch =
        !normalizedSearch ||
        exam.name.toLowerCase().includes(normalizedSearch) ||
        (exam.description || "").toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && exam.is_active) ||
        (statusFilter === "inactive" && !exam.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [exams, search, statusFilter]);

  const totalExams = exams.length;
  const activeExams = exams.filter((exam) => exam.is_active).length;
  const inactiveExams = exams.filter((exam) => !exam.is_active).length;

  const formatDate = (value: string) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Academic Management
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#102A56] sm:text-3xl">
              Exams
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create an exam, then complete its setup step by step.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#102A56] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b2145]"
          >
            <span className="text-lg">+</span>
            Create Exam
          </button>
        </div>

        {(error || success) && (
          <div className="mb-5 space-y-2">
            {error && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  className="font-bold text-red-500 hover:text-red-800"
                >
                  ×
                </button>
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                ✓ {success}
              </div>
            )}
          </div>
        )}

        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">Total</p>
            <p className="mt-1 text-2xl font-black text-[#102A56]">{totalExams}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">Active</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{activeExams}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">Inactive</p>
            <p className="mt-1 text-2xl font-black text-slate-500">{inactiveExams}</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[#102A56]">Your Examinations</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {filteredExams.length} {filteredExams.length === 1 ? "exam" : "exams"} shown
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search exams..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-400 focus:bg-white sm:w-64"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | "active" | "inactive"
                  )
                }
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600 outline-none focus:border-blue-400 focus:bg-white"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                onClick={fetchExams}
                disabled={loading}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                📋
              </div>
              <h3 className="mt-4 font-bold text-[#102A56]">No exams found</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                {search || statusFilter !== "all"
                  ? "Try changing your search or status filter."
                  : "Create your first examination to get started."}
              </p>
              {!search && statusFilter === "all" && (
                <button
                  onClick={openCreateModal}
                  className="mt-5 rounded-xl bg-[#102A56] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0b2145]"
                >
                  Create First Exam
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredExams.map((exam) => (
                <div
                  key={exam.id}
                  className="p-4 transition hover:bg-slate-50/60 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <button
                      onClick={() => router.push(`/dashboard/exams/${exam.id}`)}
                      className="min-w-0 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102A56] text-sm font-black text-white">
                          {exam.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-bold text-slate-800">
                              {exam.name}
                            </h3>
                            <StatusBadge active={exam.is_active} />
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-400">
                            {exam.description || "No description"} · Created {formatDate(exam.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
                      <button
                        onClick={() => router.push(`/dashboard/exams/${exam.id}`)}
                        className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        View
                      </button>
                      <button
                        onClick={() =>
                          router.push(`/dashboard/exams/subjects?examId=${exam.id}`)
                        }
                        className="rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                      >
                        1. Subjects
                      </button>
                      <button
                        onClick={() =>
                          router.push(`/dashboard/exams/timetable?examId=${exam.id}`)
                        }
                        className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                      >
                        2. Timetable
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/marks?examId=${exam.id}`)}
                        className="rounded-xl bg-purple-50 px-3 py-2.5 text-xs font-bold text-purple-700 hover:bg-purple-100"
                      >
                        3. Marks
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/results?examId=${exam.id}`)}
                        className="rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        4. Results
                      </button>
                      <button
                        onClick={() => openEditModal(exam)}
                        className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(exam)}
                        className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create / Edit Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#102A56]">
                    ▣
                  </span>

                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {editingExam
                      ? "Update Examination"
                      : "New Examination"}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-[#102A56]">
                  {editingExam ? "Edit Exam" : "Create Exam"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingExam
                    ? "Update examination information."
                    : "Add a new examination to EduOS."}
                </p>
              </div>

              <button
                onClick={closeFormModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSaveExam}
              className="space-y-5 p-5 sm:p-6"
            >
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Exam Name *
                </label>

                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    handleFormChange("name", event.target.value)
                  }
                  placeholder="e.g. Mid Term Examination"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    handleFormChange(
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="Enter a short description..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>

              {editingExam && (
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Exam Status
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Control whether this exam is active.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleFormChange(
                        "is_active",
                        !form.is_active
                      )
                    }
                    className={`relative h-7 w-12 rounded-full transition ${
                      form.is_active
                        ? "bg-emerald-500"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        form.is_active ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 rounded-xl bg-[#102A56] px-6 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#0b2145] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingExam
                      ? "Update Exam"
                      : "Create Exam"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative overflow-hidden bg-[#102A56] px-6 py-7 text-white">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full border border-white/10" />
              <div className="absolute -bottom-16 -left-10 h-32 w-32 rounded-full border border-white/10" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-bold backdrop-blur-sm">
                    {selectedExam.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
                      Exam #{selectedExam.id}
                    </p>

                    <h2 className="mt-1 text-xl font-bold">
                      {selectedExam.name}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => setShowViewModal(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg transition hover:bg-white/20"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <DetailRow
                label="Status"
                value={
                  <StatusBadge active={selectedExam.is_active} />
                }
              />

              <DetailRow
                label="Description"
                value={
                  <span className="leading-6 text-slate-600">
                    {selectedExam.description ||
                      "No description added"}
                  </span>
                }
              />

              <DetailRow
                label="Created"
                value={formatDate(selectedExam.created_at)}
              />

              <DetailRow
                label="Last Updated"
                value={formatDate(selectedExam.updated_at)}
              />

              <div className="border-t border-slate-100 pt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Quick Manage
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      router.push(
                        `/dashboard/exams/subjects?examId=${selectedExam.id}`
                      )
                    }
                    className="rounded-xl bg-indigo-50 px-3 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    📚 Subjects
                  </button>

                  <button
                    onClick={() =>
                      router.push(
                        `/dashboard/exams/timetable?examId=${selectedExam.id}`
                      )
                    }
                    className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    🗓 Schedule
                  </button>

                  <button
                    onClick={() =>
                      router.push("/dashboard/marks")
                    }
                    className="rounded-xl bg-purple-50 px-3 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100"
                  >
                    ✍ Marks Entry
                  </button>

                  <button
                    onClick={() =>
                      router.push("/dashboard/results")
                    }
                    className="rounded-xl bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    📊 Results
                  </button>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    setShowViewModal(false);
                    openEditModal(selectedExam);
                  }}
                  className="h-11 rounded-xl bg-[#102A56] px-5 text-sm font-semibold text-white transition hover:bg-[#0b2145]"
                >
                  Edit Exam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deletingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-600">
              !
            </div>

            <h2 className="mt-5 text-xl font-bold text-[#102A56]">
              Delete Exam?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              You are about to delete{" "}
              <span className="font-semibold text-slate-700">
                {deletingExam.name}
              </span>
              . This action cannot be undone.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  if (deleting) return;
                  setShowDeleteModal(false);
                  setDeletingExam(null);
                }}
                disabled={deleting}
                className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteExam}
                disabled={deleting}
                className="h-11 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
  </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  description,
  positive = false,
}: {
  label: string;
  value: number;
  icon: string;
  description: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-[#102A56]">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            positive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-blue-50 text-[#102A56]"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />

      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
        danger
          ? "text-red-500 hover:bg-red-50"
          : "text-slate-500 hover:bg-blue-50 hover:text-[#102A56]"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>

      <div className="text-sm font-medium text-slate-700 sm:max-w-[65%] sm:text-right">
        {value}
      </div>
    </div>
  );
}