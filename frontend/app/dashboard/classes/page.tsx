"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";

type SchoolClass = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ClassForm = {
  name: string;
  description: string;
};

export default function ClassesPage() {
  const router = useRouter();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedClass, setSelectedClass] =
    useState<SchoolClass | null>(null);

  const [form, setForm] = useState<ClassForm>({
    name: "",
    description: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    fetchClasses();
  }, [router]);

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/classes/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to load classes."
        );
      }

      setClasses(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load classes.");
    } finally {
      setLoading(false);
    }
  };

  const fetchClassById = async (id: number) => {
    const token = localStorage.getItem("access_token");

    const response = await fetch(`${API_URL}/classes/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      logout();
      return null;
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.detail || "Failed to load class details."
      );
    }

    return result as SchoolClass;
  };

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return classes;
    }

    return classes.filter((schoolClass) => {
      return (
        schoolClass.name.toLowerCase().includes(query) ||
        (schoolClass.description ?? "")
          .toLowerCase()
          .includes(query) ||
        String(schoolClass.id).includes(query)
      );
    });
  }, [classes, search]);

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
    });
  };

  const openAddModal = () => {
    setError("");
    setSuccess("");
    resetForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (submitting) return;

    setShowAddModal(false);
    resetForm();
  };

  const openEditModal = async (schoolClass: SchoolClass) => {
    setError("");
    setSuccess("");
    setSelectedClass(schoolClass);

    try {
      const latest = await fetchClassById(schoolClass.id);

      if (!latest) return;

      setSelectedClass(latest);

      setForm({
        name: latest.name,
        description: latest.description ?? "",
      });

      setShowEditModal(true);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Failed to load class details."
      );
    }
  };

  const closeEditModal = () => {
    if (submitting) return;

    setShowEditModal(false);
    setSelectedClass(null);
    resetForm();
  };

  const openDeleteModal = (schoolClass: SchoolClass) => {
    setError("");
    setSuccess("");
    setSelectedClass(schoolClass);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;

    setShowDeleteModal(false);
    setSelectedClass(null);
  };

  const handleCreate = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/classes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
        }),
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to create class."
        );
      }

      setSuccess("Class created successfully.");
      setShowAddModal(false);
      resetForm();

      await fetchClasses();
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Failed to create class."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedClass) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/classes/${selectedClass.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
          }),
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to update class."
        );
      }

      setSuccess("Class updated successfully.");
      setShowEditModal(false);
      setSelectedClass(null);
      resetForm();

      await fetchClasses();
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Failed to update class."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClass) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/classes/${selectedClass.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to deactivate class."
        );
      }

      setSuccess(
        `${selectedClass.name} has been deactivated successfully.`
      );

      setShowDeleteModal(false);
      setSelectedClass(null);

      await fetchClasses();
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Failed to deactivate class."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
              EduOS · Academic Management
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
              Classes
            </h1>

            <p className="mt-0.5 text-xs text-slate-500">
              Manage school classes and academic structure
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#102a56] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73] sm:w-auto"
          >
            <span className="text-lg leading-none">+</span>
            Add Class
          </button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1500px]">
          {/* BREADCRUMB */}
          <div className="mb-6 flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => router.push("/dashboard")}
              className="transition hover:text-[#315b9b]"
            >
              Dashboard
            </button>

            <span>›</span>

            <span className="font-medium text-slate-600">
              Classes
            </span>
          </div>

          {/* ALERTS */}
          {success && (
            <Alert
              type="success"
              message={success}
              onClose={() => setSuccess("")}
            />
          )}

          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError("")}
            />
          )}

          {/* STATS */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Active Classes"
              value={classes.length}
              description="Currently available"
              icon="▤"
            />

            <StatCard
              title="Search Results"
              value={filteredClasses.length}
              description="Matching current search"
              icon="⌕"
              green
            />

            <StatCard
              title="Structure Status"
              value={classes.length > 0 ? "Ready" : "Empty"}
              description="Academic structure"
              icon="✓"
              blue
            />
          </section>

          {/* DIRECTORY */}
          <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 lg:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                    Academic Structure
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                    Class Directory
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    View and manage all active school classes.
                  </p>
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    ⌕
                  </span>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search classes..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-72"
                  />
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              {loading ? (
                <LoadingTable />
              ) : filteredClasses.length === 0 ? (
                <EmptyState
                  hasSearch={Boolean(search.trim())}
                  onAdd={openAddModal}
                />
              ) : (
                <table className="min-w-[1050px] w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Class
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Description
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Created
                      </th>

                      <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClasses.map((schoolClass) => {
                      const initials = schoolClass.name
                        .replace(/class/i, "")
                        .trim()
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <tr
                          key={schoolClass.id}
                          className="group border-b border-slate-100 transition hover:bg-blue-50/30"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102a56] text-sm font-bold text-white">
                                {initials || "CL"}
                              </div>

                              <div>
                                <p className="font-semibold text-slate-800">
                                  {schoolClass.name}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  Class #{schoolClass.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="max-w-[400px] px-6 py-4">
                            <p className="truncate text-sm text-slate-600">
                              {schoolClass.description ||
                                "No description provided"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-600">
                              {formatDate(
                                schoolClass.created_at
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Created
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() =>
                                  openEditModal(schoolClass)
                                }
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                              >
                                ✎ Edit
                              </button>

                              <button
                                onClick={() =>
                                  openDeleteModal(schoolClass)
                                }
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                              >
                                🗑 Deactivate
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && filteredClasses.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  <strong className="text-slate-600">
                    {filteredClasses.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-600">
                    {classes.length}
                  </strong>{" "}
                  active classes
                </span>

                <span>EduOS Academic Structure</span>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ADD MODAL */}
      {showAddModal && (
        <ClassModal
          title="Add New Class"
          description="Create a new class in your academic structure."
          form={form}
          setForm={setForm}
          submitting={submitting}
          submitText="Create Class"
          loadingText="Creating Class..."
          onClose={closeAddModal}
          onSubmit={handleCreate}
        />
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedClass && (
        <ClassModal
          title="Edit Class"
          description={`Update ${selectedClass.name}'s academic information.`}
          form={form}
          setForm={setForm}
          submitting={submitting}
          submitText="Save Changes"
          loadingText="Saving Changes..."
          onClose={closeEditModal}
          onSubmit={handleUpdate}
          editMode
          classId={selectedClass.id}
        />
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && selectedClass && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl">
                🗑
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#102a56]">
                Deactivate Class?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Are you sure you want to deactivate{" "}
                <strong className="text-slate-700">
                  {selectedClass.name}
                </strong>
                ?
              </p>

              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
                  Class Record
                </p>

                <div className="mt-3">
                  <p className="text-xs text-red-400">
                    Class ID
                  </p>

                  <p className="mt-1 font-semibold text-red-700">
                    #{selectedClass.id}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-400">
                The backend DELETE operation deactivates the
                class instead of permanently removing its
                database record.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting
                  ? "Deactivating..."
                  : "Yes, Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   CLASS MODAL
========================================================= */

function ClassModal({
  title,
  description,
  form,
  setForm,
  submitting,
  submitText,
  loadingText,
  onClose,
  onSubmit,
  editMode = false,
  classId,
}: {
  title: string;
  description: string;
  form: ClassForm;
  setForm: React.Dispatch<React.SetStateAction<ClassForm>>;
  submitting: boolean;
  submitText: string;
  loadingText: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  editMode?: boolean;
  classId?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
              Academic Management
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#102a56]">
              {title}
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              {description}
            </p>

            {editMode && classId && (
              <p className="mt-2 text-[11px] font-semibold text-slate-400">
                Class ID #{classId}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 p-6"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Class Name
              <span className="ml-1 text-red-500">*</span>
            </label>

            <input
              type="text"
              required
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="e.g. Class 10"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Description
            </label>

            <textarea
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              placeholder="e.g. Senior secondary class"
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? loadingText : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   ALERT
========================================================= */

function Alert({
  type,
  message,
  onClose,
}: {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const success = type === "success";

  return (
    <div
      className={`mb-5 flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm font-medium sm:px-5 ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <span>{message}</span>

      <button
        onClick={onClose}
        className="shrink-0 text-lg opacity-70 transition hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  description,
  icon,
  green = false,
  blue = false,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: string;
  green?: boolean;
  blue?: boolean;
}) {
  let iconClass = "bg-slate-100 text-slate-700";

  if (green) {
    iconClass = "bg-emerald-50 text-emerald-700";
  }

  if (blue) {
    iconClass = "bg-blue-50 text-blue-700";
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-50" />

      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold text-[#102a56]">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function LoadingTable() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="flex animate-pulse items-center gap-4"
        >
          <div className="h-11 w-11 rounded-xl bg-slate-200" />

          <div className="flex-1 space-y-2">
            <div className="h-3 w-48 rounded bg-slate-200" />
            <div className="h-2 w-32 rounded bg-slate-100" />
          </div>

          <div className="hidden h-8 w-32 rounded bg-slate-100 md:block" />

          <div className="h-8 w-36 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  hasSearch,
  onAdd,
}: {
  hasSearch: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#102a56]">
        ▤
      </div>

      <h3 className="mt-5 text-lg font-bold text-[#102a56]">
        {hasSearch
          ? "No matching classes"
          : "No classes found"}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasSearch
          ? "Try another search term."
          : "Create your first class to start building the academic structure."}
      </p>

      {!hasSearch && (
        <button
          onClick={onAdd}
          className="mt-5 rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#183d73]"
        >
          + Add Class
        </button>
      )}
    </div>
  );
}

/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(value?: string) {
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
}