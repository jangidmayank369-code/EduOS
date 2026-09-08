"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";

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

type Attendance = {
  id: number;
  student_id: number;
  date: string;
  status: string;
  marked_by?: number;
};

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams();

  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    if (!studentId) return;

    fetchStudent();
    fetchAttendance();
  }, [studentId, router]);

  const fetchStudent = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/students/${studentId}`,
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

      if (response.status === 404) {
        throw new Error("Student not found");
      }

      if (!response.ok) {
        throw new Error("Failed to fetch student");
      }

      const data = await response.json();
      setStudent(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load student");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setAttendanceLoading(true);

      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/attendance/student/${studentId}`,
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
        // Attendance may not be available for every role.
        setAttendance([]);
        return;
      }

      const data = await response.json();
      setAttendance(data);
    } catch (err) {
      console.error(err);
      setAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const attendanceStats = getAttendanceStats(attendance);

  if (loading) {
    return <ProfileLoading />;
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => router.push("/dashboard/students")}
            className="mb-6 text-sm font-semibold text-[#315b9b] hover:underline"
          >
            ← Back to Students
          </button>

          <div className="rounded-3xl border border-red-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-xl">
              !
            </div>

            <h2 className="mt-5 text-xl font-bold text-[#102a56]">
              Unable to load student
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {error || "Student record could not be found."}
            </p>

            <button
              onClick={() => router.push("/dashboard/students")}
              className="mt-6 rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#183d73]"
            >
              Back to Students
            </button>
          </div>
        </div>
      </div>
    );
  }

  const initials =
    `${student.first_name?.[0] ?? ""}${student.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
              EduOS · Student Management
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
              Student Profile
            </h1>
          </div>

          <button
            onClick={() => router.push("/dashboard/students")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#102a56] shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
          >
            ← Back to Students
          </button>
        </div>
      </header>

      <main className="px-6 py-7 lg:px-8">
        <div className="mx-auto max-w-[1450px]">
          {/* BREADCRUMB */}
          <div className="mb-6 flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => router.push("/dashboard")}
              className="hover:text-[#315b9b]"
            >
              Dashboard
            </button>

            <span>›</span>

            <button
              onClick={() => router.push("/dashboard/students")}
              className="hover:text-[#315b9b]"
            >
              Students
            </button>

            <span>›</span>

            <span className="font-medium text-slate-600">
              {student.first_name} {student.last_name}
            </span>
          </div>

          {/* PROFILE HERO */}
          <section className="relative overflow-hidden rounded-3xl bg-[#102a56] p-6 text-white shadow-lg lg:p-8">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" />
            <div className="absolute -bottom-28 right-40 h-72 w-72 rounded-full bg-blue-400/5" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white text-xl font-bold text-[#102a56] shadow-lg">
                  {initials || "ST"}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold lg:text-3xl">
                      {student.first_name} {student.last_name}
                    </h2>

                    {student.is_active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300">
                        Inactive
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-blue-100">
                    Admission No.{" "}
                    <span className="font-semibold text-white">
                      {student.admission_number}
                    </span>
                  </p>

                  <p className="mt-1 text-xs text-blue-200">
                    Student ID #{student.id}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 lg:min-w-[220px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">
                  Current Class
                </p>

                <p className="mt-2 text-lg font-bold">
                  {student.school_class?.name || "Not assigned"}
                </p>

                <p className="mt-1 text-xs text-blue-200">
                  {student.class_id
                    ? `Class ID #${student.class_id}`
                    : "No class assigned"}
                </p>
              </div>
            </div>
          </section>

          {/* SUMMARY CARDS */}
          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Attendance"
              value={
                attendance.length > 0
                  ? `${attendanceStats.percentage}%`
                  : "0%"
              }
              description={`${attendanceStats.present} present days`}
              icon="✓"
              green
            />

            <SummaryCard
              title="Present"
              value={attendanceStats.present}
              description="Attendance records"
              icon="P"
            />

            <SummaryCard
              title="Absent"
              value={attendanceStats.absent}
              description="Attendance records"
              icon="A"
              red
            />

            <SummaryCard
              title="Total Records"
              value={attendanceStats.total}
              description="Attendance history"
              icon="▤"
              blue
            />
          </section>

          {/* PERSONAL + CONTACT */}
          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <InfoCard
              title="Personal Information"
              subtitle="Basic student details"
            >
              <InfoRow
                label="Full Name"
                value={`${student.first_name} ${student.last_name}`}
              />

              <InfoRow
                label="Date of Birth"
                value={
                  student.date_of_birth
                    ? formatDate(student.date_of_birth)
                    : "Not provided"
                }
              />

              <InfoRow
                label="Gender"
                value={student.gender || "Not provided"}
              />

              <InfoRow
                label="Admission Number"
                value={student.admission_number}
              />
            </InfoCard>

            <InfoCard
              title="Contact Information"
              subtitle="Communication details"
            >
              <InfoRow
                label="Email"
                value={student.email || "Not provided"}
              />

              <InfoRow
                label="Phone"
                value={student.phone || "Not provided"}
              />

              <InfoRow
                label="Address"
                value={student.address || "Not provided"}
              />

              <InfoRow
                label="Account Status"
                value={student.is_active ? "Active" : "Inactive"}
                valueClass={
                  student.is_active
                    ? "text-emerald-600"
                    : "text-slate-500"
                }
              />
            </InfoCard>
          </section>

          {/* ATTENDANCE */}
          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                  Attendance
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                  Attendance History
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Daily attendance records for this student.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-sm font-semibold text-slate-600">
                  {attendanceStats.percentage}% attendance
                </span>
              </div>
            </div>

            {attendanceLoading ? (
              <AttendanceLoading />
            ) : attendance.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500">
                  ✓
                </div>

                <h3 className="mt-4 font-bold text-[#102a56]">
                  No attendance records
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Attendance has not been recorded for this student yet.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-[650px] w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Date
                        </th>

                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Day
                        </th>

                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Status
                        </th>

                        <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Record ID
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {attendance.map((record) => {
                        const isPresent =
                          record.status.toLowerCase() === "present";

                        return (
                          <tr
                            key={record.id}
                            className="border-b border-slate-100 transition hover:bg-blue-50/30"
                          >
                            <td className="px-6 py-4">
                              <span className="text-sm font-semibold text-slate-700">
                                {formatDate(record.date)}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-sm text-slate-500">
                              {getDayName(record.date)}
                            </td>

                            <td className="px-6 py-4">
                              {isPresent ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Present
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                  {capitalize(record.status)}
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-right">
                              <span className="text-xs font-medium text-slate-400">
                                #{record.id}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                  <div className="flex flex-wrap gap-5 text-xs">
                    <span className="text-slate-500">
                      Total:{" "}
                      <strong className="text-slate-700">
                        {attendanceStats.total}
                      </strong>
                    </span>

                    <span className="text-emerald-600">
                      Present:{" "}
                      <strong>
                        {attendanceStats.present}
                      </strong>
                    </span>

                    <span className="text-red-600">
                      Absent:{" "}
                      <strong>
                        {attendanceStats.absent}
                      </strong>
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* MARKS & RESULTS */}
          <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <FeatureCard
              icon="▣"
              title="Marks & Results"
              description="View examination marks, subject-wise performance and published results for this student."
              action="Coming with Exams"
            />

            <FeatureCard
              icon="□"
              title="Assignments"
              description="View assigned work, submission status, deadlines and academic activity."
              action="Coming with Assignments"
            />
          </section>

          {/* ACCOUNT METADATA */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                Record Information
              </p>

              <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                System Details
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Metadata
                label="Student ID"
                value={`#${student.id}`}
              />

              <Metadata
                label="Class ID"
                value={
                  student.class_id
                    ? `#${student.class_id}`
                    : "Not assigned"
                }
              />

              <Metadata
                label="Created"
                value={
                  student.created_at
                    ? formatDateTime(student.created_at)
                    : "Not available"
                }
              />

              <Metadata
                label="Last Updated"
                value={
                  student.updated_at
                    ? formatDateTime(student.updated_at)
                    : "Not available"
                }
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  description,
  icon,
  green = false,
  red = false,
  blue = false,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: string;
  green?: boolean;
  red?: boolean;
  blue?: boolean;
}) {
  let iconClass = "bg-slate-100 text-slate-700";

  if (green) {
    iconClass = "bg-emerald-50 text-emerald-700";
  }

  if (red) {
    iconClass = "bg-red-50 text-red-700";
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
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INFO CARD
========================================================= */

function InfoCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-[#102a56]">
          {title}
        </h2>

        <p className="mt-1 text-xs text-slate-400">
          {subtitle}
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   INFO ROW
========================================================= */

function InfoRow({
  label,
  value,
  valueClass = "text-slate-700",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>

      <span
        className={`text-sm font-semibold sm:max-w-[65%] sm:text-right ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   FEATURE CARD
========================================================= */

function FeatureCard({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-[#315b9b]">
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#102a56]">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>

          <span className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
            {action}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   METADATA
========================================================= */

function Metadata({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   ATTENDANCE LOADING
========================================================= */

function AttendanceLoading() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="flex animate-pulse items-center justify-between gap-4"
        >
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-4 w-20 rounded bg-slate-100" />
          <div className="h-7 w-20 rounded-full bg-slate-100" />
          <div className="h-4 w-10 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   PROFILE LOADING
========================================================= */

function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] px-6 py-8 lg:px-8">
      <div className="mx-auto max-w-[1450px]">
        <div className="animate-pulse">
          <div className="mb-6 h-4 w-48 rounded bg-slate-200" />

          <div className="h-48 rounded-3xl bg-slate-300" />

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-32 rounded-2xl bg-white"
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="h-72 rounded-3xl bg-white" />
            <div className="h-72 rounded-3xl bg-white" />
          </div>

          <div className="mt-6 h-96 rounded-3xl bg-white" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getAttendanceStats(records: Attendance[]) {
  const total = records.length;

  const present = records.filter(
    (record) => record.status.toLowerCase() === "present"
  ).length;

  const absent = records.filter(
    (record) => record.status.toLowerCase() === "absent"
  ).length;

  const percentage =
    total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    total,
    present,
    absent,
    percentage,
  };
}

function formatDate(value: string) {
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

function formatDateTime(value: string) {
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

function getDayName(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
  });
}

function capitalize(value: string) {
  if (!value) return "";

  return value.charAt(0).toUpperCase() + value.slice(1);
}