"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://127.0.0.1:8000";

const STATUSES = [
  "APPLIED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "ADMITTED",
  "CANCELLED",
];

type AcademicSession = {
  id: number;
  name?: string;
  year?: string;
  is_active?: boolean;
};

type SchoolClass = {
  id: number;
  name: string;
};

type Admission = {
  id: number;
  application_number: string;
  academic_session_id: number;
  applying_class_id: number | null;
  student_id: number | null;

  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;

  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  parent_relation: string | null;

  previous_school_name: string | null;
  previous_class: string | null;
  previous_school_result: string | null;

  status: string;
  remarks: string | null;

  reviewed_by_user_id: number | null;
  reviewed_at: string | null;

  created_at: string;
  updated_at: string;
};

type AdmissionForm = {
  academic_session_id: string;
  applying_class_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;

  parent_first_name: string;
  parent_last_name: string;
  parent_phone: string;
  parent_email: string;
  parent_relation: string;

  previous_school_name: string;
  previous_class: string;
  previous_school_result: string;

  remarks: string;
};

const emptyForm: AdmissionForm = {
  academic_session_id: "",
  applying_class_id: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",

  parent_first_name: "",
  parent_last_name: "",
  parent_phone: "",
  parent_email: "",
  parent_relation: "",

  previous_school_name: "",
  previous_class: "",
  previous_school_result: "",

  remarks: "",
};

export default function AdmissionsPage() {
  const router = useRouter();

  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingAdmission, setEditingAdmission] =
    useState<Admission | null>(null);
  const [form, setForm] = useState<AdmissionForm>(emptyForm);

  const [detailAdmission, setDetailAdmission] =
    useState<Admission | null>(null);

  const [statusTarget, setStatusTarget] =
    useState<Admission | null>(null);
  const [statusValue, setStatusValue] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");

  const [cancelTarget, setCancelTarget] =
    useState<Admission | null>(null);

  const [admitTarget, setAdmitTarget] =
    useState<Admission | null>(null);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const getHeaders = () => ({
    Authorization: `Bearer ${
      localStorage.getItem("access_token") || ""
    }`,
    "Content-Type": "application/json",
  });

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const handleApiError = async (response: Response) => {
    if (response.status === 401) {
      logout();
      throw new Error("Session expired");
    }

    let message = "Something went wrong.";

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data?.detail)) {
        message = data.detail
          .map((item: any) => item?.msg || "Validation error")
          .join(", ");
      }
    } catch {
      // Keep default.
    }

    throw new Error(message);
  };

  const loadAdmissions = async () => {
    try {
      const response = await fetch(`${API_BASE}/admissions/`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      const data = await response.json();
      setAdmissions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message || "Unable to load admissions.",
        );
      }
    }
  };

  const loadSupportingData = async () => {
    try {
      const [sessionResponse, classResponse] =
        await Promise.all([
          fetch(`${API_BASE}/academic-sessions/`, {
            headers: getHeaders(),
          }),
          fetch(`${API_BASE}/classes/`, {
            headers: getHeaders(),
          }),
        ]);

      if (!sessionResponse.ok) {
        await handleApiError(sessionResponse);
      }

      if (!classResponse.ok) {
        await handleApiError(classResponse);
      }

      const sessionData = await sessionResponse.json();
      const classData = await classResponse.json();

      setSessions(
        Array.isArray(sessionData) ? sessionData : [],
      );

      setClasses(
        Array.isArray(classData) ? classData : [],
      );
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message ||
            "Unable to load academic data.",
        );
      }
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");

    await Promise.all([
      loadAdmissions(),
      loadSupportingData(),
    ]);

    setLoading(false);
  };

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    loadAll();
  }, []);

  const sessionMap = useMemo(() => {
    const map = new Map<number, string>();

    sessions.forEach((session) => {
      map.set(
        session.id,
        session.name ||
          session.year ||
          `Session ${session.id}`,
      );
    });

    return map;
  }, [sessions]);

  const classMap = useMemo(() => {
    const map = new Map<number, string>();

    classes.forEach((item) => {
      map.set(item.id, item.name);
    });

    return map;
  }, [classes]);

  const filteredAdmissions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return admissions.filter((item) => {
      if (
        statusFilter &&
        item.status !== statusFilter
      ) {
        return false;
      }

      if (
        sessionFilter &&
        String(item.academic_session_id) !==
          sessionFilter
      ) {
        return false;
      }

      if (
        classFilter &&
        String(item.applying_class_id) !== classFilter
      ) {
        return false;
      }

      if (query) {
        const fullName =
          `${item.first_name} ${item.last_name}`.toLowerCase();

        const parentName =
          `${item.parent_first_name || ""} ${
            item.parent_last_name || ""
          }`.toLowerCase();

        const searchable = [
          item.application_number,
          fullName,
          parentName,
          item.phone || "",
          item.parent_phone || "",
          item.email || "",
          item.parent_email || "",
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [
    admissions,
    search,
    statusFilter,
    sessionFilter,
    classFilter,
  ]);

  const counts = useMemo(() => {
    return {
      total: admissions.length,
      applied: admissions.filter(
        (item) => item.status === "APPLIED",
      ).length,
      review: admissions.filter(
        (item) => item.status === "UNDER_REVIEW",
      ).length,
      approved: admissions.filter(
        (item) => item.status === "APPROVED",
      ).length,
      admitted: admissions.filter(
        (item) => item.status === "ADMITTED",
      ).length,
    };
  }, [admissions]);

  const showSuccess = (message: string) => {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3500);
  };

  const openCreate = () => {
    const activeSession =
      sessions.find((item) => item.is_active) ||
      sessions[0];

    setEditingAdmission(null);

    setForm({
      ...emptyForm,
      academic_session_id: activeSession
        ? String(activeSession.id)
        : "",
    });

    setFormOpen(true);
    setError("");
  };

  const openEdit = (admission: Admission) => {
    if (
      admission.status === "ADMITTED" ||
      admission.status === "CANCELLED"
    ) {
      setError(
        "ADMITTED or CANCELLED applications cannot be edited.",
      );
      return;
    }

    setEditingAdmission(admission);

    setForm({
      academic_session_id: String(
        admission.academic_session_id,
      ),
      applying_class_id:
        admission.applying_class_id !== null
          ? String(admission.applying_class_id)
          : "",

      first_name: admission.first_name,
      last_name: admission.last_name,
      date_of_birth:
        admission.date_of_birth || "",
      gender: admission.gender || "",
      phone: admission.phone || "",
      email: admission.email || "",
      address: admission.address || "",

      parent_first_name:
        admission.parent_first_name || "",
      parent_last_name:
        admission.parent_last_name || "",
      parent_phone: admission.parent_phone || "",
      parent_email: admission.parent_email || "",
      parent_relation:
        admission.parent_relation || "",

      previous_school_name:
        admission.previous_school_name || "",
      previous_class:
        admission.previous_class || "",
      previous_school_result:
        admission.previous_school_result || "",

      remarks: admission.remarks || "",
    });

    setFormOpen(true);
    setError("");
  };

  const saveAdmission = async () => {
    if (!form.academic_session_id) {
      setError("Academic session is required.");
      return;
    }

    if (!form.first_name.trim()) {
      setError("Student first name is required.");
      return;
    }

    if (!form.last_name.trim()) {
      setError("Student last name is required.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const payload = {
        academic_session_id: Number(
          form.academic_session_id,
        ),
        applying_class_id: form.applying_class_id
          ? Number(form.applying_class_id)
          : null,

        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),

        date_of_birth:
          form.date_of_birth || null,
        gender: form.gender.trim() || null,

        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,

        parent_first_name:
          form.parent_first_name.trim() || null,
        parent_last_name:
          form.parent_last_name.trim() || null,
        parent_phone:
          form.parent_phone.trim() || null,
        parent_email:
          form.parent_email.trim() || null,
        parent_relation:
          form.parent_relation.trim() || null,

        previous_school_name:
          form.previous_school_name.trim() || null,
        previous_class:
          form.previous_class.trim() || null,
        previous_school_result:
          form.previous_school_result.trim() || null,

        remarks: form.remarks.trim() || null,
      };

      const url = editingAdmission
        ? `${API_BASE}/admissions/${editingAdmission.id}`
        : `${API_BASE}/admissions/`;

      const response = await fetch(url, {
        method: editingAdmission ? "PUT" : "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      setFormOpen(false);

      showSuccess(
        editingAdmission
          ? "Admission application updated."
          : "Admission application created.",
      );

      await loadAdmissions();
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message ||
            "Unable to save admission application.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openStatusChange = (
    admission: Admission,
    status: string,
  ) => {
    if (
      admission.status === "ADMITTED" ||
      admission.status === "CANCELLED"
    ) {
      setError(
        "This application cannot change status anymore.",
      );
      return;
    }

    setStatusTarget(admission);
    setStatusValue(status);
    setStatusRemarks(admission.remarks || "");
    setError("");
  };

  const updateStatus = async () => {
    if (!statusTarget || !statusValue) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/admissions/${statusTarget.id}/status`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({
            status: statusValue,
            remarks:
              statusRemarks.trim() || null,
          }),
        },
      );

      if (!response.ok) {
        await handleApiError(response);
      }

      setStatusTarget(null);

      showSuccess(
        `Application moved to ${statusValue.replaceAll(
          "_",
          " ",
        )}.`,
      );

      await loadAdmissions();
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message ||
            "Unable to update admission status.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const cancelAdmission = async () => {
    if (!cancelTarget) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/admissions/${cancelTarget.id}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        },
      );

      if (!response.ok) {
        await handleApiError(response);
      }

      setCancelTarget(null);

      showSuccess("Admission application cancelled.");

      await loadAdmissions();
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message ||
            "Unable to cancel application.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const admitStudent = async () => {
    if (!admitTarget) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/admissions/${admitTarget.id}/admit`,
        {
          method: "POST",
          headers: getHeaders(),
        },
      );

      if (!response.ok) {
        await handleApiError(response);
      }

      const result = await response.json();

      setAdmitTarget(null);

      const studentId =
        result?.student_id ??
        result?.student?.id ??
        null;

      showSuccess(
        studentId
          ? `Admission completed. Student ID: ${studentId}`
          : "Admission completed successfully.",
      );

      await loadAdmissions();
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message ||
            "Unable to complete admission.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";

    return new Date(value).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return "—";

    return new Date(value).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Student Lifecycle
              </p>

              <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Admissions
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Manage applications from enquiry to
                completed admission without repeating
                student information.
              </p>
            </div>

            <button
              onClick={openCreate}
              className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#16396f]"
            >
              + New Admission
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
                className="font-bold"
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {success}
            </div>
          )}

          {/* Pipeline */}
          <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-5">
            <PipelineCard
              label="All Applications"
              value={counts.total}
              active={!statusFilter}
              onClick={() => setStatusFilter("")}
            />

            <PipelineCard
              label="Applied"
              value={counts.applied}
              active={statusFilter === "APPLIED"}
              onClick={() =>
                setStatusFilter("APPLIED")
              }
            />

            <PipelineCard
              label="Under Review"
              value={counts.review}
              active={
                statusFilter === "UNDER_REVIEW"
              }
              onClick={() =>
                setStatusFilter("UNDER_REVIEW")
              }
            />

            <PipelineCard
              label="Approved"
              value={counts.approved}
              active={statusFilter === "APPROVED"}
              onClick={() =>
                setStatusFilter("APPROVED")
              }
            />

            <PipelineCard
              label="Admitted"
              value={counts.admitted}
              active={statusFilter === "ADMITTED"}
              onClick={() =>
                setStatusFilter("ADMITTED")
              }
            />
          </div>

          {/* Filters */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 xl:grid-cols-[1fr_190px_210px_210px]">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search application, student, parent or phone..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
              >
                <option value="">All Statuses</option>

                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>

              <select
                value={sessionFilter}
                onChange={(e) =>
                  setSessionFilter(e.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
              >
                <option value="">All Sessions</option>

                {sessions.map((session) => (
                  <option
                    key={session.id}
                    value={session.id}
                  >
                    {session.name ||
                      session.year ||
                      `Session ${session.id}`}
                  </option>
                ))}
              </select>

              <select
                value={classFilter}
                onChange={(e) =>
                  setClassFilter(e.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
              >
                <option value="">All Classes</option>

                {classes.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Table */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-bold text-[#102A56]">
                  Applications
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  {filteredAdmissions.length} application
                  {filteredAdmissions.length === 1
                    ? ""
                    : "s"} visible
                </p>
              </div>
            </div>

            {loading ? (
              <div className="px-5 py-16 text-center text-sm text-slate-400">
                Loading admissions...
              </div>
            ) : filteredAdmissions.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                  🎓
                </div>

                <p className="font-semibold text-slate-700">
                  No admission applications found
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Try changing your filters or create a
                  new application.
                </p>

                <button
                  onClick={openCreate}
                  className="mt-4 rounded-lg bg-[#102A56] px-4 py-2 text-xs font-semibold text-white"
                >
                  + New Admission
                </button>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Application
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Student
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Class / Session
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Parent
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Status
                        </th>

                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredAdmissions.map(
                        (admission) => (
                          <tr
                            key={admission.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                          >
                            <td className="px-5 py-4">
                              <p className="text-sm font-bold text-[#102A56]">
                                {
                                  admission.application_number
                                }
                              </p>

                              <p className="mt-1 text-[11px] text-slate-400">
                                {formatDate(
                                  admission.created_at,
                                )}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <p className="text-sm font-semibold text-slate-800">
                                {admission.first_name}{" "}
                                {admission.last_name}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {admission.phone ||
                                  admission.email ||
                                  "No contact"}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-700">
                                {admission.applying_class_id
                                  ? classMap.get(
                                      admission.applying_class_id,
                                    ) || "Unknown class"
                                  : "Class not selected"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {sessionMap.get(
                                  admission.academic_session_id,
                                ) ||
                                  `Session ${admission.academic_session_id}`}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-700">
                                {admission.parent_first_name ||
                                admission.parent_last_name
                                  ? `${admission.parent_first_name || ""} ${admission.parent_last_name || ""}`.trim()
                                  : "—"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {admission.parent_phone ||
                                  admission.parent_email ||
                                  "No contact"}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={
                                  admission.status
                                }
                              />
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() =>
                                    setDetailAdmission(
                                      admission,
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  View
                                </button>

                                {admission.status ===
                                  "APPROVED" && (
                                  <button
                                    onClick={() =>
                                      setAdmitTarget(
                                        admission,
                                      )
                                    }
                                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                                  >
                                    Admit
                                  </button>
                                )}

                                {admission.status !==
                                  "ADMITTED" &&
                                  admission.status !==
                                    "CANCELLED" && (
                                    <button
                                      onClick={() =>
                                        openEdit(
                                          admission,
                                        )
                                      }
                                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                      Edit
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="divide-y divide-slate-100 lg:hidden">
                  {filteredAdmissions.map(
                    (admission) => (
                      <div
                        key={admission.id}
                        className="p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-blue-600">
                              {
                                admission.application_number
                              }
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {admission.first_name}{" "}
                              {admission.last_name}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {admission.phone ||
                                "No phone"}
                            </p>
                          </div>

                          <StatusBadge
                            status={admission.status}
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
                          <InfoMini
                            label="Class"
                            value={
                              admission.applying_class_id
                                ? classMap.get(
                                    admission.applying_class_id,
                                  ) || "Unknown"
                                : "Not selected"
                            }
                          />

                          <InfoMini
                            label="Session"
                            value={
                              sessionMap.get(
                                admission.academic_session_id,
                              ) || "Unknown"
                            }
                          />

                          <InfoMini
                            label="Parent"
                            value={
                              admission.parent_first_name ||
                              admission.parent_last_name
                                ? `${admission.parent_first_name || ""} ${admission.parent_last_name || ""}`.trim()
                                : "—"
                            }
                          />

                          <InfoMini
                            label="Applied"
                            value={formatDate(
                              admission.created_at,
                            )}
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              setDetailAdmission(
                                admission,
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600"
                          >
                            View Details
                          </button>

                          {admission.status ===
                            "APPROVED" && (
                            <button
                              onClick={() =>
                                setAdmitTarget(
                                  admission,
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white"
                            >
                              Admit Student
                            </button>
                          )}

                          {admission.status !==
                            "ADMITTED" &&
                            admission.status !==
                              "CANCELLED" && (
                              <>
                                <button
                                  onClick={() =>
                                    openEdit(
                                      admission,
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() =>
                                    setCancelTarget(
                                      admission,
                                    )
                                  }
                                  className="rounded-lg border border-red-100 px-3 py-2.5 text-xs font-semibold text-red-600"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Create / Edit Modal */}
      {formOpen && (
        <Modal
          title={
            editingAdmission
              ? "Edit Admission"
              : "New Admission"
          }
          subtitle={
            editingAdmission
              ? "Update the application without re-entering unrelated information."
              : "Capture the student, parent and previous-school information once."
          }
          onClose={() => {
            if (!actionLoading) {
              setFormOpen(false);
            }
          }}
          wide
        >
          <div className="space-y-7">
            <FormSection
              title="Admission Setup"
              description="Academic session and intended class."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Academic Session"
                  required
                  value={
                    form.academic_session_id
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      academic_session_id:
                        value,
                    }))
                  }
                  options={sessions.map(
                    (session) => ({
                      value: String(
                        session.id,
                      ),
                      label:
                        session.name ||
                        session.year ||
                        `Session ${session.id}`,
                    }),
                  )}
                />

                <SelectField
                  label="Applying Class"
                  value={
                    form.applying_class_id
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      applying_class_id:
                        value,
                    }))
                  }
                  options={classes.map(
                    (item) => ({
                      value: String(item.id),
                      label: item.name,
                    }),
                  )}
                  placeholder="Class not selected"
                />
              </div>
            </FormSection>

            <FormSection
              title="Student Information"
              description="Basic information required for the admission application."
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InputField
                  label="First Name"
                  required
                  value={form.first_name}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      first_name: value,
                    }))
                  }
                />

                <InputField
                  label="Last Name"
                  required
                  value={form.last_name}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      last_name: value,
                    }))
                  }
                />

                <InputField
                  label="Date of Birth"
                  type="date"
                  value={
                    form.date_of_birth
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      date_of_birth: value,
                    }))
                  }
                />

                <SelectField
                  label="Gender"
                  value={form.gender}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      gender: value,
                    }))
                  }
                  options={[
                    {
                      value: "Male",
                      label: "Male",
                    },
                    {
                      value: "Female",
                      label: "Female",
                    },
                    {
                      value: "Other",
                      label: "Other",
                    },
                  ]}
                  placeholder="Select gender"
                />

                <InputField
                  label="Phone"
                  value={form.phone}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      phone: value,
                    }))
                  }
                />

                <InputField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      email: value,
                    }))
                  }
                />
              </div>

              <div className="mt-4">
                <TextAreaField
                  label="Address"
                  value={form.address}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      address: value,
                    }))
                  }
                />
              </div>
            </FormSection>

            <FormSection
              title="Parent / Guardian"
              description="This information is used when the admission is converted into a student record."
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InputField
                  label="Parent First Name"
                  value={
                    form.parent_first_name
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      parent_first_name:
                        value,
                    }))
                  }
                />

                <InputField
                  label="Parent Last Name"
                  value={
                    form.parent_last_name
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      parent_last_name:
                        value,
                    }))
                  }
                />

                <InputField
                  label="Parent Relation"
                  placeholder="Father / Mother / Guardian"
                  value={
                    form.parent_relation
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      parent_relation:
                        value,
                    }))
                  }
                />

                <InputField
                  label="Parent Phone"
                  value={form.parent_phone}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      parent_phone: value,
                    }))
                  }
                />

                <InputField
                  label="Parent Email"
                  type="email"
                  value={form.parent_email}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      parent_email: value,
                    }))
                  }
                />
              </div>
            </FormSection>

            <FormSection
              title="Previous School"
              description="Optional academic history captured during admission."
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InputField
                  label="Previous School"
                  value={
                    form.previous_school_name
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      previous_school_name:
                        value,
                    }))
                  }
                />

                <InputField
                  label="Previous Class"
                  value={
                    form.previous_class
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      previous_class: value,
                    }))
                  }
                />

                <InputField
                  label="Previous Result"
                  value={
                    form.previous_school_result
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      previous_school_result:
                        value,
                    }))
                  }
                />
              </div>
            </FormSection>

            <FormSection
              title="Remarks"
              description="Additional admission notes."
            >
              <TextAreaField
                label="Remarks"
                value={form.remarks}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    remarks: value,
                  }))
                }
              />
            </FormSection>

            <button
              onClick={saveAdmission}
              disabled={actionLoading}
              className="w-full rounded-xl bg-[#102A56] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 disabled:opacity-50"
            >
              {actionLoading
                ? "Saving..."
                : editingAdmission
                  ? "Save Admission Changes"
                  : "Create Admission Application"}
            </button>
          </div>
        </Modal>
      )}

      {/* Details */}
      {detailAdmission && (
        <Modal
          title={detailAdmission.application_number}
          subtitle={`${detailAdmission.first_name} ${detailAdmission.last_name}`}
          onClose={() =>
            setDetailAdmission(null)
          }
          wide
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                status={detailAdmission.status}
              />

              {detailAdmission.student_id && (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  Student ID:{" "}
                  {detailAdmission.student_id}
                </span>
              )}
            </div>

            <DetailSection title="Student">
              <DetailGrid
                items={[
                  [
                    "Full Name",
                    `${detailAdmission.first_name} ${detailAdmission.last_name}`,
                  ],
                  [
                    "Date of Birth",
                    formatDate(
                      detailAdmission.date_of_birth,
                    ),
                  ],
                  [
                    "Gender",
                    detailAdmission.gender ||
                      "—",
                  ],
                  [
                    "Phone",
                    detailAdmission.phone ||
                      "—",
                  ],
                  [
                    "Email",
                    detailAdmission.email ||
                      "—",
                  ],
                  [
                    "Address",
                    detailAdmission.address ||
                      "—",
                  ],
                ]}
              />
            </DetailSection>

            <DetailSection title="Academic">
              <DetailGrid
                items={[
                  [
                    "Session",
                    sessionMap.get(
                      detailAdmission.academic_session_id,
                    ) ||
                      `Session ${detailAdmission.academic_session_id}`,
                  ],
                  [
                    "Applying Class",
                    detailAdmission.applying_class_id
                      ? classMap.get(
                          detailAdmission.applying_class_id,
                        ) || "Unknown"
                      : "Not selected",
                  ],
                  [
                    "Previous School",
                    detailAdmission.previous_school_name ||
                      "—",
                  ],
                  [
                    "Previous Class",
                    detailAdmission.previous_class ||
                      "—",
                  ],
                  [
                    "Previous Result",
                    detailAdmission.previous_school_result ||
                      "—",
                  ],
                ]}
              />
            </DetailSection>

            <DetailSection title="Parent / Guardian">
              <DetailGrid
                items={[
                  [
                    "Name",
                    `${detailAdmission.parent_first_name || ""} ${detailAdmission.parent_last_name || ""}`.trim() ||
                      "—",
                  ],
                  [
                    "Relation",
                    detailAdmission.parent_relation ||
                      "—",
                  ],
                  [
                    "Phone",
                    detailAdmission.parent_phone ||
                      "—",
                  ],
                  [
                    "Email",
                    detailAdmission.parent_email ||
                      "—",
                  ],
                ]}
              />
            </DetailSection>

            <DetailSection title="Application">
              <DetailGrid
                items={[
                  [
                    "Applied On",
                    formatDateTime(
                      detailAdmission.created_at,
                    ),
                  ],
                  [
                    "Last Updated",
                    formatDateTime(
                      detailAdmission.updated_at,
                    ),
                  ],
                  [
                    "Reviewed By",
                    detailAdmission.reviewed_by_user_id
                      ? `User ${detailAdmission.reviewed_by_user_id}`
                      : "Not reviewed",
                  ],
                  [
                    "Reviewed At",
                    formatDateTime(
                      detailAdmission.reviewed_at,
                    ),
                  ],
                  [
                    "Remarks",
                    detailAdmission.remarks ||
                      "—",
                  ],
                ]}
              />
            </DetailSection>

            {detailAdmission.status !==
              "ADMITTED" &&
              detailAdmission.status !==
                "CANCELLED" && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                  {detailAdmission.status ===
                    "APPLIED" && (
                    <ActionButton
                      label="Start Review"
                      onClick={() => {
                        setDetailAdmission(null);
                        openStatusChange(
                          detailAdmission,
                          "UNDER_REVIEW",
                        );
                      }}
                    />
                  )}

                  {detailAdmission.status ===
                    "UNDER_REVIEW" && (
                    <>
                      <ActionButton
                        label="Approve"
                        variant="success"
                        onClick={() => {
                          setDetailAdmission(null);
                          openStatusChange(
                            detailAdmission,
                            "APPROVED",
                          );
                        }}
                      />

                      <ActionButton
                        label="Reject"
                        variant="danger"
                        onClick={() => {
                          setDetailAdmission(null);
                          openStatusChange(
                            detailAdmission,
                            "REJECTED",
                          );
                        }}
                      />
                    </>
                  )}

                  {detailAdmission.status ===
                    "APPROVED" && (
                    <ActionButton
                      label="Admit Student"
                      variant="success"
                      onClick={() => {
                        setDetailAdmission(null);
                        setAdmitTarget(
                          detailAdmission,
                        );
                      }}
                    />
                  )}

                  <ActionButton
                    label="Edit"
                    onClick={() => {
                      setDetailAdmission(null);
                      openEdit(
                        detailAdmission,
                      );
                    }}
                  />

                  <ActionButton
                    label="Cancel Application"
                    variant="danger"
                    onClick={() => {
                      setDetailAdmission(null);
                      setCancelTarget(
                        detailAdmission,
                      );
                    }}
                  />
                </div>
              )}
          </div>
        </Modal>
      )}

      {/* Status */}
      {statusTarget && (
        <Modal
          title="Change Application Status"
          subtitle={`${statusTarget.application_number} · ${statusTarget.first_name} ${statusTarget.last_name}`}
          onClose={() => {
            if (!actionLoading) {
              setStatusTarget(null);
            }
          }}
        >
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                New Status
              </label>

              <select
                value={statusValue}
                onChange={(e) =>
                  setStatusValue(e.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              >
                {STATUSES.filter(
                  (status) =>
                    status !== "ADMITTED" &&
                    status !== "CANCELLED",
                ).map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <TextAreaField
              label="Remarks"
              value={statusRemarks}
              onChange={setStatusRemarks}
            />

            <button
              onClick={updateStatus}
              disabled={actionLoading}
              className="w-full rounded-xl bg-[#102A56] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionLoading
                ? "Updating..."
                : "Update Status"}
            </button>
          </div>
        </Modal>
      )}

      {/* Cancel */}
      {cancelTarget && (
        <Modal
          title="Cancel Application"
          subtitle="This action changes the application status to CANCELLED."
          onClose={() => {
            if (!actionLoading) {
              setCancelTarget(null);
            }
          }}
        >
          <div className="space-y-5">
            <div className="rounded-xl bg-red-50 p-4">
              <p className="font-semibold text-red-800">
                {cancelTarget.application_number}
              </p>

              <p className="mt-1 text-xs text-red-600">
                {cancelTarget.first_name}{" "}
                {cancelTarget.last_name}
              </p>
            </div>

            <p className="text-sm leading-6 text-slate-600">
              Are you sure you want to cancel this admission
              application? It will remain in the system for
              historical tracking.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setCancelTarget(null)
                }
                disabled={actionLoading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                Keep Application
              </button>

              <button
                onClick={cancelAdmission}
                disabled={actionLoading}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actionLoading
                  ? "Cancelling..."
                  : "Cancel Application"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Admit */}
      {admitTarget && (
        <Modal
          title="Complete Admission"
          subtitle="This is the final step of the admission workflow."
          onClose={() => {
            if (!actionLoading) {
              setAdmitTarget(null);
            }
          }}
        >
          <div className="space-y-5">
            <div className="rounded-2xl bg-emerald-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Approved Application
              </p>

              <p className="mt-2 text-lg font-bold text-emerald-900">
                {admitTarget.first_name}{" "}
                {admitTarget.last_name}
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                {admitTarget.application_number}
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-[#102A56]">
                EduOS will complete the admission
              </p>

              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-blue-700">
                <li>• Create the student record</li>
                <li>• Create the academic enrollment</li>
                <li>• Link or reuse the parent</li>
                <li>• Mark this application as ADMITTED</li>
              </ul>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              The backend performs this conversion as one
              admission operation. You do not need to create
              the student separately.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setAdmitTarget(null)
                }
                disabled={actionLoading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                Back
              </button>

              <button
                onClick={admitStudent}
                disabled={actionLoading}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actionLoading
                  ? "Completing..."
                  : "Complete Admission"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PipelineCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-blue-200 bg-[#102A56] text-white shadow-lg shadow-blue-900/10"
          : "border-slate-200 bg-white hover:border-blue-100 hover:bg-blue-50/30"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wider ${
          active
            ? "text-blue-200"
            : "text-slate-400"
        }`}
      >
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    APPLIED:
      "bg-blue-50 text-blue-700",
    UNDER_REVIEW:
      "bg-amber-50 text-amber-700",
    APPROVED:
      "bg-emerald-50 text-emerald-700",
    REJECTED:
      "bg-red-50 text-red-700",
    ADMITTED:
      "bg-indigo-50 text-indigo-700",
    CANCELLED:
      "bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
        styles[status] ||
        "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function InfoMini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#102A56]">
          {title}
        </h3>

        <p className="mt-1 text-xs text-slate-400">
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-bold text-[#102A56]">
        {title}
      </h3>

      {children}
    </section>
  );
}

function DetailGrid({
  items,
}: {
  items: [string, string][];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {label}
          </p>

          <p className="mt-1 break-words text-sm font-medium text-slate-700">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "success" | "danger";
}) {
  const styles = {
    default:
      "border-slate-200 text-slate-600 hover:bg-slate-50",
    success:
      "border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700",
    danger:
      "border-red-100 text-red-600 hover:bg-red-50",
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${styles[variant]}`}
    >
      {label}
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  placeholder = "Select...",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
  required?: boolean;
  placeholder?: string;
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

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      >
        <option value="">
          {placeholder}
        </option>

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        rows={3}
        className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      />
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={`max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
          wide ? "max-w-4xl" : "max-w-lg"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-bold text-[#102A56]">
              {title}
            </h3>

            {subtitle && (
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-500 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}