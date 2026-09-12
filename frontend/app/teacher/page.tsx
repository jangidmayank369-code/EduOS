"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type BasicProfile = {
  teacher_id: number;
  employee_number?: string | null;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
};

type SectionItem = {
  section_id: number;
  section_name: string;
  class_id: number;
  class_name: string;
  subject_id?: number | null;
  subject_name?: string | null;
  subject_code?: string | null;
  is_class_teacher: boolean;
};

type TimetableEntry = {
  day_of_week: string;
  period_number: number;
  period_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  subject_name?: string | null;
  room_number?: string | null;
};

type AttendanceSummary = {
  total_records: number;
  present: number;
  absent: number;
  half_day: number;
  on_leave: number;
  holiday: number;
  late: number;
  other: number;
};

type Teacher360 = {
  basic_profile: BasicProfile;
  sections: SectionItem[];
  timetable: TimetableEntry[];
  total_subject_assignments: number;
  total_sections: number;
  class_teacher_sections: number;
  weekly_timetable_periods: number;
  attendance_summary: AttendanceSummary;
  leave_summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
};

type Workspace = {
  total_students: number;
  total_sections: number;
  total_subject_assignments: number;
};

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || "";
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = getToken();

  if (!token) {
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    window.location.href = "/login";
    throw new Error("Session expired. Please login again.");
  }

  if (!response.ok) {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload
    ) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string") throw new Error(detail);
    }

    throw new Error(`Request failed (${response.status})`);
  }

  return payload as T;
}

function fullName(profile: BasicProfile) {
  return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Teacher";
}

function initials(profile: BasicProfile) {
  return fullName(profile)
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const parts = value.split(":");
  if (parts.length < 2) return value;

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg">
          {icon}
        </div>
      </div>
      <div className="mt-3 text-xs font-medium text-slate-400">{hint}</div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_35px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#102a56] text-base text-white">
          {icon}
        </div>
        <span className="text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
          →
        </span>
      </div>
      <div className="mt-5 text-base font-bold text-slate-900">{title}</div>
      <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
    </button>
  );
}

export default function TeacherPage() {
  const router = useRouter();

  const [data, setData] = useState<Teacher360 | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [profile, teacherWorkspace] = await Promise.all([
        apiFetch<Teacher360>("/teachers/me/360-profile"),
        apiFetch<{
          total_students: number;
          total_sections: number;
          total_subject_assignments: number;
        }>("/teacher/me/workspace"),
      ]);

      setData(profile);
      setWorkspace(teacherWorkspace);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load teacher dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groupedTimetable = useMemo(() => {
    if (!data) return [];

    const dayOrder = [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ];

    return [...data.timetable]
      .sort((a, b) => {
        const dayA = dayOrder.indexOf(a.day_of_week.toUpperCase());
        const dayB = dayOrder.indexOf(b.day_of_week.toUpperCase());

        if (dayA !== dayB) return dayA - dayB;
        return a.period_number - b.period_number;
      })
      .slice(0, 8);
  }, [data]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <div className="h-48 animate-pulse rounded-3xl bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl bg-slate-200"
              />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="h-96 animate-pulse rounded-2xl bg-slate-200 xl:col-span-2" />
            <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-red-50 p-7">
          <div className="text-sm font-bold uppercase tracking-wide text-red-700">
            Teacher Portal
          </div>
          <h1 className="mt-2 text-2xl font-black text-red-950">
            Unable to load the teaching dashboard
          </h1>
          <p className="mt-2 text-sm leading-6 text-red-800">
            {error || "We could not load your teacher profile. Please try again."}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#173b75]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const profile = data.basic_profile;
  const teacherName = fullName(profile);
  const present = data.attendance_summary.present;
  const attendanceTotal = data.attendance_summary.total_records;
  const attendanceRate =
    attendanceTotal > 0 ? Math.round((present / attendanceTotal) * 100) : 0;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative p-6 md:p-8">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#102a56]/[0.035] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#315b9b]/[0.035] blur-2xl" />

            <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex items-start gap-4 md:gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#102a56] text-xl font-black text-white ring-1 ring-[#102a56]/10 md:h-20 md:w-20 md:text-2xl">
                  {initials(profile)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#315b9b]">
                    Teaching Dashboard
                  </div>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-[#102a56] md:text-4xl">
                    Welcome back, {teacherName}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span>
                      Employee {profile.employee_number || "—"}
                    </span>
                    {profile.email ? <span>• {profile.email}</span> : null}
                    {profile.phone ? <span>• {profile.phone}</span> : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/teacher/profile")}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:bg-white/15"
                >
                  360° Profile
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/teacher/timetable")}
                  className="rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#173b75] hover:bg-slate-100"
                >
                  View Timetable
                </button>
              </div>
            </div>

            <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-400">
                  Assigned sections
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {workspace?.total_sections ?? data.total_sections}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-400">
                  Students assigned
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {workspace?.total_students ?? "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-400">
                  Subject allocations
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {workspace?.total_subject_assignments ??
                    data.total_subject_assignments}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Assigned Sections"
            value={data.total_sections}
            hint={`${data.class_teacher_sections} class-teacher section${data.class_teacher_sections === 1 ? "" : "s"}`}
            icon="⌂"
          />
          <MetricCard
            label="Subject Allocations"
            value={data.total_subject_assignments}
            hint="Active teaching assignments"
            icon="▤"
          />
          <MetricCard
            label="Scheduled Periods"
            value={data.weekly_timetable_periods}
            hint="Scheduled teaching periods"
            icon="◷"
          />
          <MetricCard
            label="Attendance Management"
            value={`${attendanceRate}%`}
            hint={`${present} present records of ${attendanceTotal}`}
            icon="✓"
          />
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Daily Operations
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#102a56]">
                Teaching Workspace
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage your teaching responsibilities, student records and academic activities from one place.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickAction
              icon="✓"
              title="Attendance Management"
              description="Record and update daily attendance for your assigned sections."
              href="/teacher/attendance"
            />
            <QuickAction
              icon="▤"
              title="Assessments & Marks"
              description="Record, review and update assessments for your assigned subjects."
              href="/teacher/marks"
            />
            <QuickAction
              icon="▣"
              title="Academic Work"
              description="Manage classwork, homework and related student work."
              href="/teacher/homework"
            />
            <QuickAction
              icon="◌"
              title="Parent Communication"
              description="Connect with parents of students assigned to your sections."
              href="/teacher/parents"
            />
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Assigned Sections & Subjects
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Review the classes, subjects and students currently assigned to you.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/teacher/students")}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Open Student Directory
              </button>
            </div>

            {data.sections.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No active teaching assignments are currently available.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {data.sections.slice(0, 8).map((section) => (
                  <button
                    key={`${section.section_id}-${section.subject_id ?? "class"}`}
                    type="button"
                    onClick={() => router.push("/teacher/students")}
                    className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-900">
                          {section.class_name} - {section.section_name}
                        </div>
                        <div className="mt-1 truncate text-sm text-slate-500">
                          {section.subject_name || "Class Teacher"}
                          {section.subject_code
                            ? ` (${section.subject_code})`
                            : ""}
                        </div>
                      </div>
                      {section.is_class_teacher ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                          Class Teacher
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Attendance Management Overview
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  A quick overview of your recorded attendance.
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-base">
                ✓
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-black tracking-tight text-slate-900">
                    {attendanceRate}%
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">
                    Recorded attendance rate
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Present: <b className="text-slate-900">{present}</b></div>
                  <div>Absent: <b className="text-slate-900">{data.attendance_summary.absent}</b></div>
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#102a56] transition-all"
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">Half Day</div>
                <div className="mt-1 text-lg font-black text-slate-900">
                  {data.attendance_summary.half_day}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">Late</div>
                <div className="mt-1 text-lg font-black text-slate-900">
                  {data.attendance_summary.late}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/teacher/attendance")}
              className="mt-4 w-full rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#173b75]"
            >
              Manage Attendance Management
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Schedule
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                Teaching Schedule
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Your current timetable and assigned teaching periods.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/teacher/timetable")}
              className="self-start rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:self-auto"
            >
              View Full Schedule
            </button>
          </div>

          {groupedTimetable.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              No teaching schedule entries are currently available.
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {groupedTimetable.map((row, index) => (
                <div
                  key={`${row.day_of_week}-${row.period_number}-${index}`}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                      {row.day_of_week}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {row.period_name || `Period ${row.period_number}`}
                    </span>
                  </div>
                  <div className="mt-4 text-sm font-black text-slate-900">
                    {row.subject_name || "—"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {row.class_name
                      ? `${row.class_name}${row.section_name ? ` - ${row.section_name}` : ""}`
                      : "Class —"}
                  </div>
                  <div className="mt-3 text-xs font-semibold text-slate-500">
                    {formatTime(row.start_time)} – {formatTime(row.end_time)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Room {row.room_number || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => router.push("/teacher/tasks")}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#315b9b]">
              Administrative Assignments
            </div>
            <div className="mt-2 text-lg font-black text-slate-900">
              Assigned Tasks
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              Review assigned responsibilities, update progress and submit completed work.
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/teacher/profile")}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#315b9b]">
              Professional Profile
            </div>
            <div className="mt-2 text-lg font-black text-slate-900">
              Teacher 360° Profile
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              Review your employment details, timetable, attendance, payroll information and documents.
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/teacher/students")}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#315b9b]">
              Student Scope
            </div>
            <div className="mt-2 text-lg font-black text-slate-900">
              Students Under Your Care
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              Access the students associated with your assigned sections and subjects.
            </p>
          </button>
        </section>
      </div>
    </div>
  );
}
