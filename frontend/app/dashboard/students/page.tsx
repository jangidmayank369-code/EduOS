"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
};

type Student = {
  id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  class_id?: number | null;
  school_class?: {
    id: number;
    name: string;
  } | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type StudentForm = {
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  class_id: string;
};

const emptyForm: StudentForm = {
  admission_number: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  email: "",
  phone: "",
  address: "",
  class_id: "",
};

export default function StudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [loading, setLoading] = useState(true);
  const [classesLoading, setClassesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [form, setForm] = useState<StudentForm>(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    void Promise.all([fetchStudents(), fetchClasses()]);
  }, [router]);

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const apiRequest = async (
    path: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = localStorage.getItem("access_token");

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      logout();
      throw new Error("Your session has expired. Please login again.");
    }

    return response;
  };

  const readError = async (response: Response, fallback: string) => {
    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        return data.detail;
      }

      if (Array.isArray(data?.detail)) {
        return data.detail
          .map((item: { msg?: string }) => item.msg || "Invalid data")
          .join(", ");
      }

      return fallback;
    } catch {
      return fallback;
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest("/students/");

      if (!response.ok) {
        throw new Error(
          await readError(response, "Failed to load students.")
        );
      }

      const data: Student[] = await response.json();
      setStudents(data);
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load students.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      setClassesLoading(true);

      const response = await apiRequest("/classes/");

      if (!response.ok) {
        throw new Error(
          await readError(response, "Failed to load classes.")
        );
      }

      const data: SchoolClass[] = await response.json();
      setClasses(data);
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load classes.");
      }
    } finally {
      setClassesLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const fullName =
        `${student.first_name} ${student.last_name}`.toLowerCase();

      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        student.admission_number.toLowerCase().includes(query) ||
        (student.email ?? "").toLowerCase().includes(query) ||
        (student.phone ?? "").toLowerCase().includes(query);

      const matchesClass =
        classFilter === "all" ||
        String(student.class_id ?? "") === classFilter;

      return matchesSearch && matchesClass;
    });
  }, [students, search, classFilter]);

  const activeStudents = students.filter(
    (student) => student.is_active
  ).length;

  const inactiveStudents = students.filter(
    (student) => !student.is_active
  ).length;

  const assignedStudents = students.filter(
    (student) => student.class_id !== null && student.class_id !== undefined
  ).length;

  const resetForm = () => {
    setForm({ ...emptyForm });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingStudent(null);
    resetForm();
  };

  const openAddForm = () => {
    setError("");
    setSuccess("");
    setEditingStudent(null);
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (student: Student) => {
    setError("");
    setSuccess("");
    setEditingStudent(student);

    setForm({
      admission_number: student.admission_number,
      first_name: student.first_name,
      last_name: student.last_name,
      date_of_birth: student.date_of_birth
        ? student.date_of_birth.slice(0, 10)
        : "",
      gender: student.gender ?? "",
      email: student.email ?? "",
      phone: student.phone ?? "",
      address: student.address ?? "",
      class_id:
        student.class_id !== null && student.class_id !== undefined
          ? String(student.class_id)
          : "",
    });

    setShowForm(true);
  };

  const handleInput = (
    field: keyof StudentForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!form.first_name.trim()) {
      return "First name is required.";
    }

    if (!form.last_name.trim()) {
      return "Last name is required.";
    }

    if (form.email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(form.email.trim())) {
        return "Please enter a valid email address.";
      }
    }

    return "";
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const isEditing = Boolean(editingStudent);

      const payload = isEditing
        ? {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            date_of_birth: form.date_of_birth || null,
            gender: form.gender || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            class_id: form.class_id
              ? Number(form.class_id)
              : null,
          }
        : {
            admission_number: form.admission_number.trim(),
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            date_of_birth: form.date_of_birth || null,
            gender: form.gender || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            class_id: form.class_id
              ? Number(form.class_id)
              : null,
          };

      const response = await apiRequest(
        isEditing
          ? `/students/${editingStudent!.id}`
          : "/students/",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            isEditing
              ? "Failed to update student."
              : "Failed to create student."
          )
        );
      }

      setSuccess(
        isEditing
          ? "Student updated successfully."
          : "Student added successfully."
      );

      closeForm();
      await fetchStudents();
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (student: Student) => {
    const confirmed = window.confirm(
      `Deactivate ${student.first_name} ${student.last_name}?`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/students/${student.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Failed to deactivate student."
          )
        );
      }

      setSuccess(
        `${student.first_name} ${student.last_name} has been deactivated.`
      );

      await fetchStudents();
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to deactivate student.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#315b9b] sm:text-[11px]">
              EduOS · Academic Management
            </p>

            <h1 className="mt-1 text-xl font-bold tracking-tight text-[#102a56] sm:text-2xl">
              Students
            </h1>

            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
              Manage student records and enrollment
            </p>
          </div>

          <button
            onClick={openAddForm}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-[#102a56] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73] sm:px-4"
          >
            <span className="text-lg leading-none">+</span>
            <span className="hidden sm:inline">Add Student</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => router.push("/dashboard")}
              className="transition hover:text-[#315b9b]"
            >
              Dashboard
            </button>

            <span>›</span>

            <span className="font-medium text-slate-600">
              Students
            </span>
          </div>

          {success && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 sm:px-5">
              <span>{success}</span>

              <button
                onClick={() => setSuccess("")}
                className="text-lg leading-none text-emerald-500 hover:text-emerald-700"
              >
                ×
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:px-5">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
                className="text-lg leading-none text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard
              title="Total Students"
              value={students.length}
              description="Visible student records"
              icon="👨‍🎓"
            />

            <OverviewCard
              title="Active"
              value={activeStudents}
              description="Currently active"
              icon="✓"
              green
            />

            <OverviewCard
              title="Inactive"
              value={inactiveStudents}
              description="Deactivated records"
              icon="−"
            />

            <OverviewCard
              title="Class Assigned"
              value={assignedStudents}
              description="Students with a class"
              icon="🏫"
              blue
            />
          </section>

          <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 lg:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                    Student Directory
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                    All Students
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Search, filter, edit, deactivate and open
                    student profiles.
                  </p>
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
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
                      placeholder="Search students..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 md:w-64"
                    />
                  </div>

                  <select
                    value={classFilter}
                    onChange={(event) =>
                      setClassFilter(event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All Classes</option>

                    {classes.map((schoolClass) => (
                      <option
                        key={schoolClass.id}
                        value={schoolClass.id}
                      >
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <LoadingTable />
              ) : filteredStudents.length === 0 ? (
                <EmptyState
                  search={search}
                  onAdd={openAddForm}
                />
              ) : (
                <table className="min-w-[1050px] w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Student
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Admission No.
                      </th>

                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Class
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
                    {filteredStudents.map((student) => {
                      const initials =
                        `${student.first_name?.[0] ?? ""}${student.last_name?.[0] ?? ""}`.toUpperCase();

                      return (
                        <tr
                          key={student.id}
                          className="group border-b border-slate-100 transition hover:bg-blue-50/30"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102a56] text-sm font-bold text-white">
                                {initials || "S"}
                              </div>

                              <div>
                                <p className="font-semibold text-slate-800">
                                  {student.first_name}{" "}
                                  {student.last_name}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  Student ID #{student.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                              {student.admission_number}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {student.school_class?.name ? (
                              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                                {student.school_class.name}
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">
                                Not assigned
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div>
                              <p className="max-w-[220px] truncate text-sm text-slate-600">
                                {student.email || "No email"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {student.phone || "No phone"}
                              </p>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {student.is_active ? (
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

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  router.push(
                                    `/dashboard/students/${student.id}`
                                  )
                                }
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#102a56] shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
                              >
                                View
                              </button>

                              {student.is_active && (
                                <>
                                  <button
                                    onClick={() =>
                                      openEditForm(student)
                                    }
                                    className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    disabled={deleting}
                                    onClick={() =>
                                      void handleDeactivate(
                                        student
                                      )
                                    }
                                    className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Deactivate
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && filteredStudents.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  <strong className="text-slate-600">
                    {filteredStudents.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-600">
                    {students.length}
                  </strong>{" "}
                  students
                </span>

                <span>EduOS Student Directory</span>
              </div>
            )}
          </section>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                  Student Management
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                  {editingStudent
                    ? "Edit Student"
                    : "Add New Student"}
                </h2>

                {editingStudent && (
                  <p className="mt-1 text-xs text-slate-400">
                    Admission number cannot be changed.
                  </p>
                )}
              </div>

              <button
                onClick={closeForm}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6 p-5 sm:p-6"
            >
              <div>
                <div className="mb-4">
                  <h3 className="font-bold text-[#102a56]">
                    Basic Information
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    Enter the student's identity and admission
                    details.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label="Admission Number"
                    required={!editingStudent}
                    disabled={Boolean(editingStudent)}
                    value={form.admission_number}
                    onChange={(value) =>
                      handleInput(
                        "admission_number",
                        value
                      )
                    }
                    placeholder="e.g. ADM001"
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
                    label="Date of Birth"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(value) =>
                      handleInput(
                        "date_of_birth",
                        value
                      )
                    }
                  />

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Gender
                    </label>

                    <select
                      value={form.gender}
                      onChange={(event) =>
                        handleInput(
                          "gender",
                          event.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">
                        Select gender
                      </option>
                      <option value="Male">Male</option>
                      <option value="Female">
                        Female
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Class
                    </label>

                    <select
                      value={form.class_id}
                      onChange={(event) =>
                        handleInput(
                          "class_id",
                          event.target.value
                        )
                      }
                      disabled={classesLoading}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    >
                      <option value="">
                        {classesLoading
                          ? "Loading classes..."
                          : "No class assigned"}
                      </option>

                      {classes
                        .filter(
                          (schoolClass) =>
                            schoolClass.is_active
                        )
                        .map((schoolClass) => (
                          <option
                            key={schoolClass.id}
                            value={schoolClass.id}
                          >
                            {schoolClass.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <h3 className="font-bold text-[#102a56]">
                    Contact Information
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    Add contact details for communication.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(value) =>
                      handleInput("email", value)
                    }
                    placeholder="student@example.com"
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
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Address
                    </label>

                    <textarea
                      value={form.address}
                      onChange={(event) =>
                        handleInput(
                          "address",
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Student address"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
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
                    ? editingStudent
                      ? "Saving..."
                      : "Adding Student..."
                    : editingStudent
                      ? "Save Changes"
                      : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({
  title,
  value,
  description,
  icon,
  green = false,
  blue = false,
}: {
  title: string;
  value: number;
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
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}

        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      <input
        type={type}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  );
}

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

          <div className="h-8 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

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
        👨‍🎓
      </div>

      <h3 className="mt-5 text-lg font-bold text-[#102a56]">
        {search ? "No students found" : "No students yet"}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {search
          ? "Try changing your search or class filter."
          : "Start building your student directory by adding the first student."}
      </p>

      {!search && (
        <button
          onClick={onAdd}
          className="mt-5 rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#183d73]"
        >
          + Add Student
        </button>
      )}
    </div>
  );
}