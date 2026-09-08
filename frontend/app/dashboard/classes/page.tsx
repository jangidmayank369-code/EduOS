"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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
  const [statusFilter, setStatusFilter] = useState("active");

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<ClassForm>({
    name: "",
    description: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    fetchClasses();
  }, [router]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/classes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.push("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch classes");
      }

      const data = await response.json();
      setClasses(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load classes.");
    } finally {
      setLoading(false);
    }
  };

  const activeClasses = classes.filter(
    (item) => item.is_active
  ).length;

  const inactiveClasses = classes.filter(
    (item) => !item.is_active
  ).length;

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return classes.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "inactive" && !item.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [classes, search, statusFilter]);

  const handleInput = (
    field: keyof ClassForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
    });
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/classes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.push("/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to create class"
        );
      }

      setSuccess("Class added successfully.");
      resetForm();
      setShowForm(false);

      await fetchClasses();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to add class.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
              EduOS · Academic Management
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
              Classes
            </h1>

            <p className="mt-0.5 text-xs text-slate-500">
              Manage school classes and academic sections
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              setSuccess("");
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73]"
          >
            <span className="text-lg leading-none">+</span>
            Add Class
          </button>
        </div>
      </header>

      <main className="px-6 py-7 lg:px-8">
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

          {/* SUCCESS */}
          {success && (
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700">
              <span>{success}</span>

              <button
                onClick={() => setSuccess("")}
                className="text-emerald-500 hover:text-emerald-700"
              >
                ×
              </button>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-700">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <OverviewCard
              title="Total Classes"
              value={classes.length}
              description="All class records"
              icon="▤"
            />

            <OverviewCard
              title="Active Classes"
              value={activeClasses}
              description="Currently active"
              icon="✓"
              green
            />

            <OverviewCard
              title="Inactive Classes"
              value={inactiveClasses}
              description="Inactive class records"
              icon="—"
              red
            />
          </section>

          {/* CLASS DIRECTORY */}
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
                    View and manage all school classes.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {/* SEARCH */}
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
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-64"
                    />
                  </div>

                  {/* STATUS */}
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="all">All Status</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              {loading ? (
                <LoadingTable />
              ) : filteredClasses.length === 0 ? (
                <EmptyState
                  search={search}
                  onAdd={() => setShowForm(true)}
                />
              ) : (
                <table className="min-w-[850px] w-full">
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
                        Record
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClasses.map((schoolClass) => {
                      const initials = schoolClass.name
                        .replace("Class", "")
                        .trim()
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <tr
                          key={schoolClass.id}
                          className="group border-b border-slate-100 transition hover:bg-blue-50/30"
                        >
                          {/* CLASS */}
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
                                  Class ID #{schoolClass.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* DESCRIPTION */}
                          <td className="max-w-[400px] px-6 py-4">
                            <p className="truncate text-sm text-slate-600">
                              {schoolClass.description ||
                                "No description provided"}
                            </p>
                          </td>

                          {/* STATUS */}
                          <td className="px-6 py-4">
                            {schoolClass.is_active ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Inactive
                              </span>
                            )}
                          </td>

                          {/* CREATED */}
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-slate-600">
                                {schoolClass.created_at
                                  ? new Date(
                                      schoolClass.created_at
                                    ).toLocaleDateString(
                                      "en-IN",
                                      {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      }
                                    )
                                  : "—"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                Created date
                              </p>
                            </div>
                          </td>

                          {/* ID */}
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-medium text-slate-400">
                              #{schoolClass.id}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* FOOTER */}
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
                  classes
                </span>

                <span>EduOS Academic Structure</span>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ADD CLASS MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                  Academic Management
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                  Add New Class
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Create a new class in your school structure.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
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
                    handleInput("name", event.target.value)
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
                    handleInput(
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="e.g. Senior secondary class"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* ACTIONS */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Creating Class..."
                    : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   OVERVIEW CARD
========================================================= */

function OverviewCard({
  title,
  value,
  description,
  icon,
  green = false,
  red = false,
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
  green?: boolean;
  red?: boolean;
}) {
  let iconClass = "bg-slate-100 text-slate-700";

  if (green) {
    iconClass = "bg-emerald-50 text-emerald-700";
  }

  if (red) {
    iconClass = "bg-red-50 text-red-700";
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
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="flex animate-pulse items-center gap-4"
        >
          <div className="h-11 w-11 rounded-xl bg-slate-200" />

          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-2 w-28 rounded bg-slate-100" />
          </div>

          <div className="hidden h-8 w-40 rounded bg-slate-100 md:block" />

          <div className="h-8 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  search,
  onAdd,
}: {
  search: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#102a56]">
        ▤
      </div>

      <h3 className="mt-5 text-lg font-bold text-[#102a56]">
        {search ? "No classes found" : "No classes yet"}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {search
          ? "Try changing your search or status filter."
          : "Start building your academic structure by adding the first class."}
      </p>

      {!search && (
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