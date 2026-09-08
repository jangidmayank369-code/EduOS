"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";

type Teacher = {
  id: number;
  user_id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type TeacherForm = {
  user_id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
};

type TeacherUpdateForm = {
  employee_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
};

export default function TeachersPage() {
  const router = useRouter();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedTeacher, setSelectedTeacher] =
    useState<Teacher | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<TeacherForm>({
    user_id: "",
    employee_number: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
  });

  const [editForm, setEditForm] = useState<TeacherUpdateForm>({
    employee_number: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    fetchTeachers();
  }, [router]);

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/teachers/`, {
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
          result?.detail || "Failed to load teachers."
        );
      }

      setTeachers(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load teachers.");
    } finally {
      setLoading(false);
    }
  };

  const activeTeachers = teachers.filter(
    (teacher) => teacher.is_active
  ).length;

  const inactiveTeachers = teachers.filter(
    (teacher) => !teacher.is_active
  ).length;

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const fullName =
        `${teacher.first_name} ${teacher.last_name}`.toLowerCase();

      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        teacher.employee_number
          .toLowerCase()
          .includes(query) ||
        String(teacher.id).includes(query) ||
        String(teacher.user_id).includes(query) ||
        (teacher.email ?? "").toLowerCase().includes(query) ||
        (teacher.phone ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && teacher.is_active) ||
        (statusFilter === "inactive" && !teacher.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [teachers, search, statusFilter]);

  const handleInput = (
    field: keyof TeacherForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleEditInput = (
    field: keyof TeacherUpdateForm,
    value: string
  ) => {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetAddForm = () => {
    setForm({
      user_id: "",
      employee_number: "",
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
    });
  };

  const openAddModal = () => {
    setError("");
    setSuccess("");
    resetAddForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (submitting) return;

    setShowAddModal(false);
    resetAddForm();
  };

  const openEditModal = (teacher: Teacher) => {
    setError("");
    setSuccess("");

    setSelectedTeacher(teacher);

    setEditForm({
      employee_number: teacher.employee_number || "",
      first_name: teacher.first_name || "",
      last_name: teacher.last_name || "",
      phone: teacher.phone || "",
      email: teacher.email || "",
    });

    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (submitting) return;

    setShowEditModal(false);
    setSelectedTeacher(null);
  };

  const openDeleteModal = (teacher: Teacher) => {
    setError("");
    setSuccess("");
    setSelectedTeacher(teacher);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;

    setShowDeleteModal(false);
    setSelectedTeacher(null);
  };

  const handleCreateTeacher = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/teachers/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: Number(form.user_id),
          employee_number: form.employee_number.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
        }),
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to create teacher."
        );
      }

      setSuccess("Teacher created successfully.");
      setShowAddModal(false);
      resetAddForm();

      await fetchTeachers();
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Failed to create teacher."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTeacher = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedTeacher) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/teachers/${selectedTeacher.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            employee_number:
              editForm.employee_number.trim(),
            first_name: editForm.first_name.trim(),
            last_name: editForm.last_name.trim(),
            phone: editForm.phone.trim() || null,
            email: editForm.email.trim() || null,
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
          result?.detail || "Failed to update teacher."
        );
      }

      setSuccess("Teacher updated successfully.");
      setShowEditModal(false);
      setSelectedTeacher(null);

      await fetchTeachers();
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Failed to update teacher."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/teachers/${selectedTeacher.id}`,
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

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to delete teacher."
        );
      }

      setSuccess("Teacher deleted successfully.");
      setShowDeleteModal(false);
      setSelectedTeacher(null);

      await fetchTeachers();
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Failed to delete teacher."
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
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#315b9b] sm:text-[11px]">
              EduOS · Academic Management
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
              Teachers
            </h1>

            <p className="mt-0.5 text-xs text-slate-500">
              Manage faculty profiles and staff records
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#102a56] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73] sm:w-auto"
          >
            <span className="text-lg leading-none">+</span>
            Add Teacher
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
              Teachers
            </span>
          </div>

          {/* SUCCESS */}
          {success && (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 sm:px-5">
              <span>{success}</span>

              <button
                onClick={() => setSuccess("")}
                className="shrink-0 text-lg text-emerald-500 hover:text-emerald-700"
              >
                ×
              </button>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:px-5">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
                className="shrink-0 text-lg text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <OverviewCard
              title="Total Teachers"
              value={teachers.length}
              description="All faculty records"
              icon="♟"
            />

            <OverviewCard
              title="Active Teachers"
              value={activeTeachers}
              description="Currently active"
              icon="✓"
              green
            />

            <OverviewCard
              title="Inactive Teachers"
              value={inactiveTeachers}
              description="Inactive faculty records"
              icon="—"
              red
            />
          </section>

          {/* DIRECTORY */}
          <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 lg:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                    Faculty Directory
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                    All Teachers
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Search, edit and manage teacher records.
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
                      placeholder="Search teachers..."
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
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>

                    <option value="all">
                      All Status
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              {loading ? (
                <LoadingTable />
              ) : filteredTeachers.length === 0 ? (
                <EmptyState
                  search={search}
                  onAdd={openAddModal}
                />
              ) : (
                <table className="min-w-[1150px] w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Teacher
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Employee No.
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        User ID
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Contact
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTeachers.map((teacher) => {
                      const initials =
                        `${teacher.first_name?.[0] ?? ""}${teacher.last_name?.[0] ?? ""}`.toUpperCase();

                      return (
                        <tr
                          key={teacher.id}
                          className="group border-b border-slate-100 transition hover:bg-blue-50/30"
                        >
                          {/* TEACHER */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102a56] text-sm font-bold text-white">
                                {initials || "T"}
                              </div>

                              <div>
                                <p className="font-semibold text-slate-800">
                                  {teacher.first_name}{" "}
                                  {teacher.last_name}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  Teacher ID #{teacher.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* EMPLOYEE */}
                          <td className="px-6 py-4">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                              {teacher.employee_number}
                            </span>
                          </td>

                          {/* USER ID */}
                          <td className="px-6 py-4">
                            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                              User #{teacher.user_id}
                            </span>
                          </td>

                          {/* CONTACT */}
                          <td className="px-6 py-4">
                            <div>
                              <p className="max-w-[230px] truncate text-sm text-slate-600">
                                {teacher.email ||
                                  "No email"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {teacher.phone ||
                                  "No phone"}
                              </p>
                            </div>
                          </td>

                          {/* STATUS */}
                          <td className="px-6 py-4">
                            {teacher.is_active ? (
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

                          {/* ACTIONS */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() =>
                                  openEditModal(
                                    teacher
                                  )
                                }
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                              >
                                ✎ Edit
                              </button>

                              <button
                                onClick={() =>
                                  openDeleteModal(
                                    teacher
                                  )
                                }
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                              >
                                🗑 Delete
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

            {/* FOOTER */}
            {!loading &&
              filteredTeachers.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing{" "}
                    <strong className="text-slate-600">
                      {filteredTeachers.length}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-slate-600">
                      {teachers.length}
                    </strong>{" "}
                    teachers
                  </span>

                  <span>
                    EduOS Faculty Directory
                  </span>
                </div>
              )}
          </section>
        </div>
      </main>

      {/* ADD TEACHER MODAL */}
      {showAddModal && (
        <ModalShell onClose={closeAddModal}>
          <div className="border-b border-slate-200 px-6 py-5">
            <ModalHeader
              eyebrow="Faculty Management"
              title="Add New Teacher"
              description="Create a teacher profile and link it to an existing user account."
              onClose={closeAddModal}
            />
          </div>

          <form
            onSubmit={handleCreateTeacher}
            className="space-y-6 p-6"
          >
            <div>
              <div className="mb-4">
                <h3 className="font-bold text-[#102a56]">
                  Account Mapping
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Link this teacher profile to an existing teacher-role user account.
                </p>
              </div>

              <FormField
                label="User ID"
                required
                type="number"
                value={form.user_id}
                onChange={(value) =>
                  handleInput("user_id", value)
                }
                placeholder="e.g. 5"
              />
            </div>

            <div>
              <div className="mb-4">
                <h3 className="font-bold text-[#102a56]">
                  Teacher Information
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Enter the faculty member&apos;s professional details.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Employee Number"
                  required
                  value={form.employee_number}
                  onChange={(value) =>
                    handleInput(
                      "employee_number",
                      value
                    )
                  }
                  placeholder="e.g. EMP002"
                />

                <FormField
                  label="First Name"
                  required
                  value={form.first_name}
                  onChange={(value) =>
                    handleInput("first_name", value)
                  }
                  placeholder="First name"
                />

                <FormField
                  label="Last Name"
                  required
                  value={form.last_name}
                  onChange={(value) =>
                    handleInput("last_name", value)
                  }
                  placeholder="Last name"
                />

                <FormField
                  label="Phone"
                  value={form.phone}
                  onChange={(value) =>
                    handleInput("phone", value)
                  }
                  placeholder="Phone number"
                />

                <div className="md:col-span-2">
                  <FormField
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(value) =>
                      handleInput("email", value)
                    }
                    placeholder="teacher@example.com"
                  />
                </div>
              </div>
            </div>

            <ModalActions
              onCancel={closeAddModal}
              loading={submitting}
              submitText="Add Teacher"
              loadingText="Adding Teacher..."
            />
          </form>
        </ModalShell>
      )}

      {/* EDIT TEACHER MODAL */}
      {showEditModal && selectedTeacher && (
        <ModalShell onClose={closeEditModal}>
          <div className="border-b border-slate-200 px-6 py-5">
            <ModalHeader
              eyebrow="Faculty Management"
              title="Edit Teacher"
              description={`Update ${selectedTeacher.first_name} ${selectedTeacher.last_name}'s faculty information.`}
              onClose={closeEditModal}
            />
          </div>

          <form
            onSubmit={handleUpdateTeacher}
            className="space-y-6 p-6"
          >
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#102a56] text-sm font-bold text-white">
                  {`${selectedTeacher.first_name?.[0] ?? ""}${selectedTeacher.last_name?.[0] ?? ""}`.toUpperCase()}
                </div>

                <div>
                  <p className="font-semibold text-[#102a56]">
                    {selectedTeacher.first_name}{" "}
                    {selectedTeacher.last_name}
                  </p>

                  <p className="text-xs text-slate-500">
                    Teacher #{selectedTeacher.id} · User #
                    {selectedTeacher.user_id}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Employee Number"
                required
                value={editForm.employee_number}
                onChange={(value) =>
                  handleEditInput(
                    "employee_number",
                    value
                  )
                }
                placeholder="EMP001"
              />

              <FormField
                label="First Name"
                required
                value={editForm.first_name}
                onChange={(value) =>
                  handleEditInput(
                    "first_name",
                    value
                  )
                }
                placeholder="First name"
              />

              <FormField
                label="Last Name"
                required
                value={editForm.last_name}
                onChange={(value) =>
                  handleEditInput(
                    "last_name",
                    value
                  )
                }
                placeholder="Last name"
              />

              <FormField
                label="Phone"
                value={editForm.phone}
                onChange={(value) =>
                  handleEditInput("phone", value)
                }
                placeholder="Phone number"
              />

              <div className="md:col-span-2">
                <FormField
                  label="Email"
                  type="email"
                  value={editForm.email}
                  onChange={(value) =>
                    handleEditInput("email", value)
                  }
                  placeholder="teacher@example.com"
                />
              </div>
            </div>

            <ModalActions
              onCancel={closeEditModal}
              loading={submitting}
              submitText="Save Changes"
              loadingText="Saving Changes..."
            />
          </form>
        </ModalShell>
      )}

      {/* DELETE CONFIRMATION */}
      {showDeleteModal && selectedTeacher && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl">
                🗑
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#102a56]">
                Delete Teacher?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Are you sure you want to delete{" "}
                <strong className="text-slate-700">
                  {selectedTeacher.first_name}{" "}
                  {selectedTeacher.last_name}
                </strong>
                ? This action will call the teacher delete API.
              </p>

              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
                  Teacher Record
                </p>

                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-red-400">
                      Teacher ID
                    </p>

                    <p className="font-semibold text-red-700">
                      #{selectedTeacher.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-red-400">
                      Employee No.
                    </p>

                    <p className="font-semibold text-red-700">
                      {selectedTeacher.employee_number}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteTeacher}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting
                  ? "Deleting..."
                  : "Yes, Delete Teacher"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MODAL SHELL
========================================================= */

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
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
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   MODAL HEADER
========================================================= */

function ModalHeader({
  eyebrow,
  title,
  description,
  onClose,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
          {eyebrow}
        </p>

        <h2 className="mt-1 text-xl font-bold text-[#102a56]">
          {title}
        </h2>

        <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
      >
        ×
      </button>
    </div>
  );
}

/* =========================================================
   MODAL ACTIONS
========================================================= */

function ModalActions({
  onCancel,
  loading,
  submitText,
  loadingText,
}: {
  onCancel: () => void;
  loading: boolean;
  submitText: string;
  loadingText: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? loadingText : submitText}
      </button>
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
   FORM FIELD
========================================================= */

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        required={required}
        min={type === "number" ? 1 : undefined}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
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

          <div className="hidden h-8 w-24 rounded bg-slate-100 md:block" />

          <div className="h-8 w-28 rounded bg-slate-100" />
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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
        ♟
      </div>

      <h3 className="mt-5 text-lg font-bold text-[#102a56]">
        No teachers found
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {search
          ? "No teacher records match your current search."
          : "There are no teacher records available in this view yet."}
      </p>

      {!search && (
        <button
          onClick={onAdd}
          className="mt-5 rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#183d73]"
        >
          + Add Teacher
        </button>
      )}
    </div>
  );
}