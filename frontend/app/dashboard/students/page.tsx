"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Student = {
  id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  class_id: number | null;
  section_id: number | null;
  section?: {
    id: number;
    class_id: number;
    name: string;
    class_teacher_id: number | null;
  } | null;
  school_class?: {
    id: number;
    name: string;
  } | null;
  is_active: boolean;
  status: StudentStatus;
  status_changed_at: string;
  status_reason: string | null;
  created_at: string;
  updated_at: string;
};

type SchoolClass = {
  id: number;
  name: string;
};

type SchoolSection = {
  id: number;
  class_id: number;
  name: string;
  class_teacher_id: number | null;
  is_active?: boolean;
};

type StudentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "TRANSFERRED"
  | "WITHDRAWN"
  | "PASSED_OUT"
  | "ALUMNI";

type StatusHistory = {
  id: number;
  student_id: number;
  old_status: string;
  new_status: string;
  reason: string | null;
  changed_at: string;
  changed_by_user_id: number | null;
};

const STATUS_OPTIONS: StudentStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "TRANSFERRED",
  "WITHDRAWN",
  "PASSED_OUT",
  "ALUMNI",
];

const statusStyles: Record<StudentStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 border-slate-200",
  TRANSFERRED: "bg-blue-50 text-blue-700 border-blue-200",
  WITHDRAWN: "bg-red-50 text-red-700 border-red-200",
  PASSED_OUT: "bg-violet-50 text-violet-700 border-violet-200",
  ALUMNI: "bg-amber-50 text-amber-700 border-amber-200",
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function StudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<SchoolSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StudentStatus>(
    "ALL",
  );

  const [loading, setLoading] = useState(true);
  const [classesLoading, setClassesLoading] = useState(true);
  const [error, setError] = useState("");

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [studentForm, setStudentForm] = useState({
    admission_number: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    class_id: "",
    section_id: "",
    password: "",
  });

  const [statusForm, setStatusForm] = useState<{
    status: StudentStatus;
    reason: string;
  }>({
    status: "ACTIVE",
    reason: "",
  });

  const getToken = () => localStorage.getItem("access_token");

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const apiFetch = async (
    path: string,
    options: RequestInit = {},
  ): Promise<Response> => {
    const token = getToken();

    if (!token) {
      handleUnauthorized();
      throw new Error("Authentication required");
    }

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/students/");

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load students");
      }

      const data = await response.json();
      setStudents(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load students",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSections = async (classId: number | null) => {
    if (!classId) {
      setSections([]);
      return;
    }

    try {
      setSectionsLoading(true);

      const response = await apiFetch(`/classes/${classId}/sections/`);

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load sections");
      }

      const data: SchoolSection[] = await response.json();
      setSections(data.filter((section) => section.is_active !== false));
    } catch (err) {
      setSections([]);
      setError(
        err instanceof Error ? err.message : "Failed to load sections",
      );
    } finally {
      setSectionsLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      setClassesLoading(true);

      const response = await apiFetch("/classes/");

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load classes");
      }

      const data = await response.json();
      setClasses(data);
    } catch {
      // Classes are optional for rendering the page.
    } finally {
      setClassesLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadStudents);
    void Promise.resolve().then(loadClasses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.first_name.toLowerCase().includes(query) ||
        student.last_name.toLowerCase().includes(query) ||
        student.admission_number.toLowerCase().includes(query) ||
        (student.email || "").toLowerCase().includes(query) ||
        (student.phone || "").toLowerCase().includes(query);

      const matchesClass =
        classFilter === "ALL" ||
        String(student.class_id ?? "") === classFilter;

      const matchesStatus =
        statusFilter === "ALL" || student.status === statusFilter;

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [students, search, classFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: students.length,
      active: students.filter((student) => student.status === "ACTIVE").length,
      inactive: students.filter((student) => student.status === "INACTIVE")
        .length,
      transferred: students.filter(
        (student) => student.status === "TRANSFERRED",
      ).length,
      withdrawn: students.filter((student) => student.status === "WITHDRAWN")
        .length,
      passedOut: students.filter((student) => student.status === "PASSED_OUT")
        .length,
      alumni: students.filter((student) => student.status === "ALUMNI").length,
    };
  }, [students]);

  const resetStudentForm = () => {
    setStudentForm({
      admission_number: "",
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "",
      email: "",
      phone: "",
      address: "",
      class_id: "",
      section_id: "",
      password: "",
    });
  };

  const openAddStudent = () => {
    setEditingStudent(null);
    resetStudentForm();
    setShowStudentModal(true);
    setError("");
    setSuccessMessage("");
  };

  const openEditStudent = async (student: Student) => {
    try {
      setError("");

      const response = await apiFetch(`/students/${student.id}`);

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load student details");
      }

      const data: Student = await response.json();

      setEditingStudent(data);
      setStudentForm({
        admission_number: data.admission_number,
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth || "",
        gender: data.gender || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        class_id: data.class_id ? String(data.class_id) : "",
        section_id: data.section_id ? String(data.section_id) : "",
        password: "",
      });

      await loadSections(data.class_id);
      setShowStudentModal(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load student details",
      );
    }
  };

  const saveStudent = async () => {
    if (!studentForm.first_name.trim() || !studentForm.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }

    if (!editingStudent && !studentForm.admission_number.trim()) {
      setError("Admission number is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const payload = {
        ...(editingStudent
          ? {}
          : {
              admission_number: studentForm.admission_number.trim(),
            }),
        first_name: studentForm.first_name.trim(),
        last_name: studentForm.last_name.trim(),
        date_of_birth: studentForm.date_of_birth || null,
        gender: studentForm.gender || null,
        email: studentForm.email.trim() || null,
        phone: studentForm.phone.trim() || null,
        address: studentForm.address.trim() || null,
        class_id: studentForm.class_id
          ? Number(studentForm.class_id)
          : null,
        section_id: studentForm.section_id
          ? Number(studentForm.section_id)
          : null,
        ...(editingStudent ? {} : { password: studentForm.password }),
      };

      if (!editingStudent && !studentForm.email.trim()) {
        setError("Email is required for a student login account.");
        return;
      }

      if (!editingStudent && !studentForm.password.trim()) {
        setError("Password is required for a student login account.");
        return;
      }

      const response = await apiFetch(
        editingStudent ? `/students/${editingStudent.id}` : "/students/",
        {
          method: editingStudent ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Failed to save student",
        );
      }

      setShowStudentModal(false);

      await loadStudents();

      setSuccessMessage(
        editingStudent
          ? "Student profile updated successfully."
          : "Student added successfully.",
      );

      setTimeout(() => setSuccessMessage(""), 3500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save student",
      );
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (student: Student) => {
    setSelectedStudent(student);
    setStatusForm({
      status: student.status,
      reason: "",
    });
    setShowStatusModal(true);
    setError("");
    setSuccessMessage("");
  };

  const updateStatus = async () => {
    if (!selectedStudent) return;

    if (!statusForm.reason.trim()) {
      setError("Please provide a reason for the status change.");
      return;
    }

    if (statusForm.status === selectedStudent.status) {
      setError("Please select a different status.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const params = new URLSearchParams({
        status: statusForm.status,
        reason: statusForm.reason.trim(),
      });

      const response = await apiFetch(
        `/students/${selectedStudent.id}/status?${params.toString()}`,
        {
          method: "PATCH",
        },
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Failed to update student status",
        );
      }

      setShowStatusModal(false);

      await loadStudents();

      setSuccessMessage(
        `Student status changed to ${statusForm.status.replaceAll("_", " ")}.`,
      );

      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update student status",
      );
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (student: Student) => {
    try {
      setSelectedStudent(student);
      setShowHistoryModal(true);
      setHistoryLoading(true);
      setError("");

      const response = await apiFetch(
        `/students/${student.id}/status-history`,
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Failed to load status history",
        );
      }

      const data = await response.json();
      setStatusHistory(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load status history",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const openStudentProfile = (studentId: number) => {
    router.push(`/dashboard/students/${studentId}`);
  };

  const openBulkImport = () => {
    router.push("/dashboard/students/bulk-import");
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "—";

    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const displayStatus = (status: string) => {
    return status.replaceAll("_", " ");
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Student Operations
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              Students
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Manage student profiles, lifecycle status and complete status
              history without deleting academic records.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={openBulkImport}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
            >
              <span className="text-base">⇧</span>
              Bulk Import
            </button>

            <button
              onClick={openAddStudent}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#17386f]"
            >
              <span className="text-lg leading-none">+</span>
              Add Student
            </button>
          </div>
        </div>

        {/* Success */}
        {successMessage && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
              ✓
            </span>
            {successMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100">
              !
            </span>
            <div className="flex-1">{error}</div>

            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Lifecycle stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
          {[
            ["Total", stats.total, "bg-white"],
            ["Active", stats.active, "bg-emerald-50"],
            ["Inactive", stats.inactive, "bg-slate-50"],
            ["Transferred", stats.transferred, "bg-blue-50"],
            ["Withdrawn", stats.withdrawn, "bg-red-50"],
            ["Passed Out", stats.passedOut, "bg-violet-50"],
            ["Alumni", stats.alumni, "bg-amber-50"],
          ].map(([label, value, bg]) => (
            <div
              key={String(label)}
              className={`rounded-2xl border border-slate-200 p-4 ${bg}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {label}
              </p>

              <p className="mt-2 text-2xl font-bold text-[#102A56]">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_190px_190px_190px_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, admission no., email or phone..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <select
              value={classFilter}
              onChange={(event) => {
                const value = event.target.value;
                setClassFilter(value);
                setSectionFilter("ALL");
                void loadSections(value === "ALL" ? null : Number(value));
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
            >
              <option value="ALL">All Classes</option>

              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              disabled={classFilter === "ALL" || sectionsLoading}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="ALL">
                {classFilter === "ALL" ? "Select Class for Sections" : "All Sections"}
              </option>

              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "ALL" | StudentStatus)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
            >
              <option value="ALL">All Statuses</option>

              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {displayStatus(status)}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch("");
                setClassFilter("ALL");
                setSectionFilter("ALL");
                setSections([]);
                setStatusFilter("ALL");
              }}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Showing{" "}
              <strong className="text-slate-600">
                {filteredStudents.length}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-600">{students.length}</strong>{" "}
              students
            </span>

            {classesLoading && <span>Loading classes...</span>}
          </div>
        </div>

        {/* Students */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#102A56]" />

              <p className="text-sm font-medium text-slate-500">
                Loading students...
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                ♙
              </div>

              <h3 className="mt-4 text-base font-bold text-[#102A56]">
                No students found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your filters or add a new student.
              </p>

              <button
                onClick={openBulkImport}
                className="mt-5 rounded-xl bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
              >
                Import Students in Bulk
              </button>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1050px]">
                  <thead className="border-b border-slate-100 bg-slate-50/70">
                    <tr>
                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Student
                      </th>

                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Admission
                      </th>

                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Class / Section
                      </th>

                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Status
                      </th>

                      <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Changed
                      </th>

                      <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => (
                      <tr
                        key={student.id}
                        className="transition hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-4">
                          <button
                            onClick={() => openStudentProfile(student.id)}
                            className="flex items-center gap-3 text-left"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#102A56] text-sm font-bold text-white">
                              {student.first_name.charAt(0)}
                              {student.last_name.charAt(0)}
                            </div>

                            <div>
                              <p className="font-semibold text-[#102A56] hover:text-blue-600">
                                {student.first_name} {student.last_name}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                ID #{student.id}
                              </p>
                            </div>
                          </button>
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-600">
                          {student.admission_number}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {student.school_class?.name || "Unassigned"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                              statusStyles[student.status]
                            }`}
                          >
                            {displayStatus(student.status)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm text-slate-600">
                            {formatDate(student.status_changed_at)}
                          </div>

                          {student.status_reason && (
                            <div className="mt-0.5 max-w-[180px] truncate text-xs text-slate-400">
                              {student.status_reason}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openHistory(student)}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              History
                            </button>

                            <button
                              onClick={() => openStatusModal(student)}
                              className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                            >
                              Status
                            </button>

                            <button
                              onClick={() => openEditStudent(student)}
                              className="rounded-lg bg-[#102A56] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#17386f]"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet */}
              <div className="divide-y divide-slate-100 lg:hidden">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => openStudentProfile(student.id)}
                        className="flex min-w-0 items-center gap-3 text-left"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102A56] text-sm font-bold text-white">
                          {student.first_name.charAt(0)}
                          {student.last_name.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#102A56]">
                            {student.first_name} {student.last_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {student.admission_number}
                          </p>
                        </div>
                      </button>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
                          statusStyles[student.status]
                        }`}
                      >
                        {displayStatus(student.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Class / Section
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {student.school_class?.name || "Unassigned"}
                          {student.section?.name && (
                            <span className="ml-2 text-xs font-semibold text-blue-600">
                              · {student.section.name}
                            </span>
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Status Changed
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {formatDate(student.status_changed_at)}
                        </p>
                      </div>
                    </div>

                    {student.status_reason && (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Latest Reason
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {student.status_reason}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button
                        onClick={() => openStudentProfile(student.id)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Profile
                      </button>

                      <button
                        onClick={() => openHistory(student)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        History
                      </button>

                      <button
                        onClick={() => openStatusModal(student)}
                        className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Status
                      </button>

                      <button
                        onClick={() => openEditStudent(student)}
                        className="rounded-lg bg-[#102A56] px-3 py-2 text-xs font-semibold text-white hover:bg-[#17386f]"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-[#102A56]">
                  {editingStudent ? "Edit Student" : "Add Student"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  {editingStudent
                    ? "Update student profile information."
                    : "Create a new student record."}
                </p>
              </div>

              <button
                onClick={() => setShowStudentModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              {!editingStudent && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Admission Number *
                  </label>

                  <input
                    value={studentForm.admission_number}
                    onChange={(event) =>
                      setStudentForm((prev) => ({
                        ...prev,
                        admission_number: event.target.value,
                      }))
                    }
                    placeholder="ADM001"
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  First Name *
                </label>

                <input
                  value={studentForm.first_name}
                  onChange={(event) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      first_name: event.target.value,
                    }))
                  }
                  placeholder="Rahul"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Last Name *
                </label>

                <input
                  value={studentForm.last_name}
                  onChange={(event) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      last_name: event.target.value,
                    }))
                  }
                  placeholder="Sharma"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Date of Birth
                </label>

                <input
                  type="date"
                  value={studentForm.date_of_birth}
                  onChange={(event) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      date_of_birth: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Gender
                </label>

                <select
                  value={studentForm.gender}
                  onChange={(event) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      gender: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Class
                </label>

                <select
                  value={studentForm.class_id}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStudentForm((prev) => ({
                      ...prev,
                      class_id: value,
                      section_id: "",
                    }));
                    void loadSections(value ? Number(value) : null);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">Unassigned</option>

                  {classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </div>


              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Section
                </label>

                <select
                  value={studentForm.section_id}
                  disabled={!studentForm.class_id || sectionsLoading}
                  onChange={(event) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      section_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <option value="">
                    {!studentForm.class_id
                      ? "Select class first"
                      : sectionsLoading
                        ? "Loading sections..."
                        : "Unassigned"}
                  </option>

                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>

                {studentForm.class_id && !sectionsLoading && sections.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    No active sections are configured for this class yet.
                  </p>
                )}
              </div>

              {!editingStudent && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Password *
                  </label>

                  <input
                    type="password"
                    value={studentForm.password}
                    onChange={(event) =>
                      setStudentForm((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Temporary login password"
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Email
                </label>

                <input
                  type="email"
                  value={studentForm.email}
                  onChange={(event) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="student@example.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Phone
                </label>

                <input
                  value={studentForm.phone}
                  onChange={(event) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="9876543210"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Address
                </label>

                <textarea
                  value={studentForm.address}
                  onChange={(event) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Student address"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
              <button
                onClick={() => setShowStudentModal(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={saveStudent}
                disabled={saving}
                className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white hover:bg-[#17386f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingStudent
                    ? "Save Changes"
                    : "Create Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                    Lifecycle Management
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-[#102A56]">
                    Change Student Status
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedStudent.first_name}{" "}
                    {selectedStudent.last_name} ·{" "}
                    {selectedStudent.admission_number}
                  </p>
                </div>

                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Current Status
                </p>

                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${
                    statusStyles[selectedStudent.status]
                  }`}
                >
                  {displayStatus(selectedStudent.status)}
                </span>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  New Status
                </label>

                <select
                  value={statusForm.status}
                  onChange={(event) =>
                    setStatusForm((prev) => ({
                      ...prev,
                      status: event.target.value as StudentStatus,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {displayStatus(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Reason *
                </label>

                <textarea
                  value={statusForm.reason}
                  onChange={(event) =>
                    setStatusForm((prev) => ({
                      ...prev,
                      reason: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Why is the student&apos;s lifecycle status changing?"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                Status changes are recorded in the student&apos;s history. Academic
                records are not deleted.
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
              <button
                onClick={() => setShowStatusModal(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={updateStatus}
                disabled={saving}
                className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white hover:bg-[#17386f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Updating..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  Lifecycle Timeline
                </p>

                <h2 className="mt-1 text-lg font-bold text-[#102A56]">
                  Status History
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedStudent.first_name}{" "}
                  {selectedStudent.last_name} ·{" "}
                  {selectedStudent.admission_number}
                </p>
              </div>

              <button
                onClick={() => setShowHistoryModal(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">
              {historyLoading ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#102A56]" />

                  <p className="text-sm text-slate-500">
                    Loading status history...
                  </p>
                </div>
              ) : statusHistory.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center">
                  <div className="text-2xl">◷</div>

                  <p className="mt-2 font-semibold text-[#102A56]">
                    No status changes yet
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    The student&apos;s lifecycle history will appear here.
                  </p>
                </div>
              ) : (
                <div className="relative ml-2 border-l-2 border-slate-100 pl-6">
                  {statusHistory.map((item, index) => {
                    const newStatus = item.new_status as StudentStatus;

                    return (
                      <div
                        key={item.id}
                        className={`relative ${
                          index !== statusHistory.length - 1 ? "pb-7" : ""
                        }`}
                      >
                        <span className="absolute -left-[33px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-[#102A56]" />

                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
                                  statusStyles[
                                    item.old_status as StudentStatus
                                  ] ||
                                  "border-slate-200 bg-slate-100 text-slate-600"
                                }`}
                              >
                                {displayStatus(item.old_status)}
                              </span>

                              <span className="text-slate-300">→</span>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
                                  statusStyles[newStatus] ||
                                  "border-slate-200 bg-slate-100 text-slate-600"
                                }`}
                              >
                                {displayStatus(item.new_status)}
                              </span>
                            </div>

                            <span className="text-xs text-slate-400">
                              {formatDateTime(item.changed_at)}
                            </span>
                          </div>

                          {item.reason && (
                            <div className="mt-3 border-t border-slate-200 pt-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Reason
                              </p>

                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {item.reason}
                              </p>
                            </div>
                          )}

                          {item.changed_by_user_id && (
                            <p className="mt-3 text-[11px] text-slate-400">
                              Changed by user #{item.changed_by_user_id}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-5 sm:px-6">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}