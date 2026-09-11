"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type Parent = {
  parent_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  relation_type: string;
  is_primary: boolean;
  is_emergency_contact: boolean;
  receives_notifications: boolean;
};

type Student360 = {
  student: {
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
    school_class: {
      id: number;
      name: string;
    } | null;
    is_active: boolean;
    status: string;
    status_changed_at: string;
    status_reason: string | null;
    created_at: string;
    updated_at: string;
  };

  parents: Parent[];

  status_history: {
    id: number;
    old_status: string;
    new_status: string;
    reason: string | null;
    changed_at: string;
    changed_by_user_id: number | null;
  }[];

  attendance: {
    id: number;
    student_id: number;
    date: string;
    status: string;
  }[];

  marks: {
    id: number;
    student_id: number;
    exam_id: number;
    subject_id: number;
    marks: number;
  }[];

  fees: {
    id: number;
    student_id: number;
    amount_due: number;
    amount_paid: number;
  }[];

  assignments: {
    id: number;
    class_id: number;
    subject_id: number | null;
    title: string;
    description: string | null;
    due_date: string | null;
  }[];

  documents: {
    id?: number;
    name?: string;
    type?: string;
    status?: string;
  }[];
};

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

function statusClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "INACTIVE":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "WITHDRAWN":
      return "bg-red-50 text-red-700 border-red-200";
    case "TRANSFERRED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "PASSED_OUT":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "ALUMNI":
      return "bg-violet-50 text-violet-700 border-violet-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export default function Student360Page() {
  const params = useParams();
  const router = useRouter();

  const studentId = params?.id;

  const [data, setData] = useState<Student360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeSection, setActiveSection] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);

  const loadStudent360 = async () => {
    if (!studentId) return;

    setError("");

    try {
      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/students/${studentId}/360`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail || "Unable to load student information"
        );
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load student information"
      );
    }
  };

  const refreshStudent360 = async () => {
    setRefreshing(true);
    await loadStudent360();
    setRefreshing(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!studentId) return;

    setLoading(true);

    loadStudent360().finally(() => {
      setLoading(false);
    });
  }, [studentId, router]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const attendanceSummary = useMemo(() => {
    if (!data?.attendance?.length) {
      return {
        total: 0,
        present: 0,
        absent: 0,
        percentage: 0,
      };
    }

    const total = data.attendance.length;

    const present = data.attendance.filter(
      (item) => item.status?.toUpperCase() === "PRESENT"
    ).length;

    const absent = data.attendance.filter(
      (item) => item.status?.toUpperCase() === "ABSENT"
    ).length;

    return {
      total,
      present,
      absent,
      percentage: Math.round((present / total) * 100),
    };
  }, [data]);

  const feeSummary = useMemo(() => {
    const due = data?.fees?.reduce(
      (sum, item) => sum + Number(item.amount_due || 0),
      0
    ) || 0;

    const paid = data?.fees?.reduce(
      (sum, item) => sum + Number(item.amount_paid || 0),
      0
    ) || 0;

    return {
      due,
      paid,
      pending: Math.max(due - paid, 0),
    };
  }, [data]);

  const navigation = [
    { id: "overview", label: "Overview" },
    { id: "parents", label: "Parents" },
    { id: "attendance", label: "Attendance" },
    { id: "marks", label: "Marks" },
    { id: "fees", label: "Fees" },
    { id: "assignments", label: "Assignments" },
    { id: "documents", label: "Documents" },
    { id: "timeline", label: "Timeline" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-5 h-5 w-32 animate-pulse rounded bg-slate-200" />

          <div className="rounded-3xl bg-slate-900 p-7">
            <div className="flex gap-5">
              <div className="h-20 w-20 animate-pulse rounded-2xl bg-white/10" />

              <div className="flex-1 space-y-3">
                <div className="h-6 w-56 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-72 animate-pulse rounded bg-white/10" />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-2xl bg-white shadow-sm"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl text-red-600">
            !
          </div>

          <h1 className="text-lg font-bold text-slate-900">
            Unable to load student
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {error || "Student information is unavailable."}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Retry
            </button>

            <button
              onClick={() => router.push("/dashboard/students")}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Students
            </button>
          </div>
        </div>
      </div>
    );
  }

  const student = data.student;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* Top navigation */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/students")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <span>←</span>
              Students
            </button>

            <button
              onClick={refreshStudent360}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{refreshing ? "↻" : "⟳"}</span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="text-xs font-medium text-slate-400">
            Student 360 · ID #{student.id}
          </div>
        </div>

        {/* Hero */}
        <div className="overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold ring-1 ring-white/10">
                  {initials(student.first_name, student.last_name)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-bold sm:text-3xl">
                      {student.first_name} {student.last_name}
                    </h1>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                        student.status
                      )}`}
                    >
                      {student.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-300">
                    <span>
                      Admission:{" "}
                      <strong className="text-white">
                        {student.admission_number}
                      </strong>
                    </span>

                    <span>
                      Class:{" "}
                      <strong className="text-white">
                        {student.school_class?.name || "Not assigned"}
                      </strong>
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    Student ID #{student.id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[440px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-slate-400">Attendance</p>
                  <p className="mt-1 text-xl font-bold">
                    {attendanceSummary.percentage}%
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-slate-400">Marks Entries</p>
                  <p className="mt-1 text-xl font-bold">
                    {data.marks.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-slate-400">Fee Pending</p>
                  <p className="mt-1 text-xl font-bold">
                    {formatCurrency(feeSummary.pending)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-slate-400">Parents</p>
                  <p className="mt-1 text-xl font-bold">
                    {data.parents.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section navigation */}
        <div className="sticky top-0 z-20 mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-w-max gap-1 p-1.5">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);

                  document
                    .getElementById(`student-section-${item.id}`)
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeSection === item.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {/* Overview */}
          <div id="student-section-overview">
            <Section
              title="Student Profile"
              subtitle="Complete basic information currently available in EduOS"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="First Name" value={student.first_name} />
                <InfoItem label="Last Name" value={student.last_name} />
                <InfoItem
                  label="Date of Birth"
                  value={formatDate(student.date_of_birth)}
                />
                <InfoItem label="Gender" value={student.gender || "—"} />

                <InfoItem label="Email" value={student.email || "—"} />
                <InfoItem label="Phone" value={student.phone || "—"} />

                <InfoItem
                  label="Class"
                  value={student.school_class?.name || "Not assigned"}
                />

                <InfoItem
                  label="Status Changed"
                  value={formatDateTime(student.status_changed_at)}
                />
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Address
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {student.address || "No address recorded"}
                </p>
              </div>

              {student.status_reason && (
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Current Status Reason
                  </p>

                  <p className="mt-1 text-sm text-amber-800">
                    {student.status_reason}
                  </p>
                </div>
              )}
            </Section>
          </div>

          {/* Parents */}
          <div id="student-section-parents">
            <Section
              title="Parents & Guardians"
              subtitle="People linked to this student and their communication responsibilities"
            >
              {data.parents.length === 0 ? (
                <EmptyState text="No parent or guardian is linked to this student yet." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.parents.map((parent) => (
                    <div
                      key={`${parent.parent_id}-${parent.relation_type}`}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-slate-900">
                            {parent.first_name} {parent.last_name}
                          </h3>

                          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {parent.relation_type}
                          </p>
                        </div>

                        {parent.is_primary && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                            Primary
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <InfoItem
                          label="Phone"
                          value={parent.phone || "—"}
                        />

                        <InfoItem
                          label="Emergency"
                          value={
                            parent.is_emergency_contact
                              ? "Yes"
                              : "No"
                          }
                        />

                        <InfoItem
                          label="Notifications"
                          value={
                            parent.receives_notifications
                              ? "Enabled"
                              : "Disabled"
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Attendance */}
          <div id="student-section-attendance">
            <Section
              title="Attendance"
              subtitle="Attendance records available for this student"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard
                  label="Total Records"
                  value={attendanceSummary.total}
                />

                <MetricCard
                  label="Present"
                  value={attendanceSummary.present}
                />

                <MetricCard
                  label="Absent"
                  value={attendanceSummary.absent}
                />
              </div>

              {data.attendance.length === 0 ? (
                <div className="mt-5">
                  <EmptyState text="No attendance records available." />
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Record ID</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {data.attendance.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {formatDate(item.date)}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                item.status?.toUpperCase() === "PRESENT"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-400">
                            #{item.id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          {/* Marks */}
          <div id="student-section-marks">
            <Section
              title="Exams & Marks"
              subtitle="Marks entries currently available for this student"
            >
              {data.marks.length === 0 ? (
                <EmptyState text="No marks have been recorded yet." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Exam</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Marks</th>
                        <th className="px-4 py-3">Record ID</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {data.marks.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            Exam #{item.exam_id}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            Subject #{item.subject_id}
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900">
                              {item.marks}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-400">
                            #{item.id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          {/* Fees */}
          <div id="student-section-fees">
            <Section
              title="Fees & Payments"
              subtitle="Fee records currently available for this student"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard
                  label="Total Due"
                  value={formatCurrency(feeSummary.due)}
                />

                <MetricCard
                  label="Total Paid"
                  value={formatCurrency(feeSummary.paid)}
                />

                <MetricCard
                  label="Pending"
                  value={formatCurrency(feeSummary.pending)}
                />
              </div>

              {data.fees.length === 0 ? (
                <div className="mt-5">
                  <EmptyState text="No fee records available." />
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fee ID</th>
                        <th className="px-4 py-3">Amount Due</th>
                        <th className="px-4 py-3">Paid</th>
                        <th className="px-4 py-3">Pending</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {data.fees.map((item) => {
                        const pending = Math.max(
                          Number(item.amount_due || 0) -
                            Number(item.amount_paid || 0),
                          0
                        );

                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-medium text-slate-700">
                              #{item.id}
                            </td>

                            <td className="px-4 py-3">
                              {formatCurrency(item.amount_due)}
                            </td>

                            <td className="px-4 py-3 text-emerald-700">
                              {formatCurrency(item.amount_paid)}
                            </td>

                            <td className="px-4 py-3 font-semibold text-red-600">
                              {formatCurrency(pending)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          {/* Assignments */}
          <div id="student-section-assignments">
            <Section
              title="Assignments"
              subtitle="Assignments associated with the student's current class"
            >
              {data.assignments.length === 0 ? (
                <EmptyState text="No assignments available for the current class." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-slate-900">
                          {assignment.title}
                        </h3>

                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                          #{assignment.id}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {assignment.description ||
                          "No description provided."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>
                          Subject: #{assignment.subject_id ?? "—"}
                        </span>

                        <span>
                          Due: {formatDate(assignment.due_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Documents */}
          <div id="student-section-documents">
            <Section
              title="Documents"
              subtitle="Student documents will appear here once the document module is connected"
            >
              <EmptyState text="No document records are currently available." />
            </Section>
          </div>

          {/* Timeline */}
          <div id="student-section-timeline">
            <Section
              title="Student Timeline"
              subtitle="Lifecycle/status history of this student"
            >
              {data.status_history.length === 0 ? (
                <EmptyState text="No status history available yet." />
              ) : (
                <div className="relative ml-2 border-l border-slate-200 pl-6">
                  {data.status_history.map((item) => (
                    <div
                      key={item.id}
                      className="relative mb-6 last:mb-0"
                    >
                      <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-900 shadow-sm" />

                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                                item.new_status
                              )}`}
                            >
                              {item.new_status.replaceAll("_", " ")}
                            </span>

                            <span className="text-xs text-slate-400">
                              from{" "}
                              {item.old_status.replaceAll("_", " ")}
                            </span>
                          </div>

                          <span className="text-xs text-slate-400">
                            {formatDateTime(item.changed_at)}
                          </span>
                        </div>

                        {item.reason && (
                          <p className="mt-3 text-sm text-slate-600">
                            {item.reason}
                          </p>
                        )}

                        {item.changed_by_user_id && (
                          <p className="mt-2 text-xs text-slate-400">
                            Changed by user #{item.changed_by_user_id}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* System metadata */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Record Created
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-800">
                {formatDateTime(student.created_at)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Last Updated
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-800">
                {formatDateTime(student.updated_at)}
              </p>
            </div>
          </div>
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
  value: string | number;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}