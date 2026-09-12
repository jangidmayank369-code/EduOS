"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type Student = {
  id: number;
  admission_number: string;
  first_name: string;
  last_name?: string | null;
  section_id: number | null;
  is_active: boolean;
  status: string;
};

type Subject = {
  id: number;
  name: string;
  code?: string | null;
  section_id: number;
};

type Section = {
  id: number;
  class_id: number;
  class_name: string;
  name: string;
  is_class_teacher: boolean;
  subjects: Subject[];
  students: Student[];
};

type Workspace = {
  teacher: { id: number; first_name: string; last_name?: string | null };
  sections: Section[];
  total_sections: number;
  total_students: number;
  total_subject_assignments: number;
  class_teacher_sections: number;
};

type AttendanceRow = {
  student_id: number;
  admission_number: string;
  student_name: string;
  date: string;
  status: string | null;
  attendance_id: number | null;
};

type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "HALF_DAY"
  | "ON_LEAVE"
  | "HOLIDAY"
  | "LATE";

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  short: string;
}> = [
  { value: "PRESENT", label: "Present", short: "P" },
  { value: "ABSENT", label: "Absent", short: "A" },
  { value: "HALF_DAY", label: "Half Day", short: "H" },
  { value: "ON_LEAVE", label: "On Leave", short: "L" },
  { value: "LATE", label: "Late", short: "LT" },
  { value: "HOLIDAY", label: "Holiday", short: "HD" },
];

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || "";
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function studentInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) {
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    window.location.href = "/login";
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data
    ) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === "string") throw new Error(detail);

      if (Array.isArray(detail)) {
        throw new Error(
          detail
            .map((item) =>
              typeof item === "object" &&
              item !== null &&
              "msg" in item
                ? String((item as { msg?: unknown }).msg)
                : "Validation error"
            )
            .join(", ")
        );
      }
    }

    throw new Error(`Request failed (${response.status})`);
  }

  return data as T;
}

function statusStyle(status: string | null) {
  switch (status) {
    case "PRESENT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ABSENT":
      return "border-red-200 bg-red-50 text-red-700";
    case "HALF_DAY":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ON_LEAVE":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "LATE":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "HOLIDAY":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-white text-slate-500";
  }
}

export default function TeacherAttendancePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayISO());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [search, setSearch] = useState("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadWorkspace = useCallback(async () => {
    try {
      setLoadingWorkspace(true);
      setError("");
      const data = await apiFetch<Workspace>("/teacher/me/workspace");
      setWorkspace(data);
      if (!selectedSectionId && data.sections.length > 0) {
        setSelectedSectionId(String(data.sections[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your assigned sections."
      );
    } finally {
      setLoadingWorkspace(false);
    }
  }, [selectedSectionId]);

  const loadAttendance = useCallback(async () => {
    if (!selectedSectionId || !attendanceDate) {
      setRows([]);
      return;
    }

    try {
      setLoadingAttendance(true);
      setError("");
      const data = await apiFetch<AttendanceRow[]>(
        `/teacher/sections/${selectedSectionId}/attendance?attendance_date=${encodeURIComponent(
          attendanceDate
        )}`
      );
      setRows(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load attendance records."
      );
      setRows([]);
    } finally {
      setLoadingAttendance(false);
    }
  }, [attendanceDate, selectedSectionId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const selectedSection = useMemo(
    () =>
      workspace?.sections.find(
        (section) => String(section.id) === selectedSectionId
      ) ?? null,
    [selectedSectionId, workspace]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      [row.student_name, row.admission_number, row.status || ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, search]);

  const counts = useMemo(() => {
    const result = {
      total: rows.length,
      PRESENT: 0,
      ABSENT: 0,
      HALF_DAY: 0,
      ON_LEAVE: 0,
      LATE: 0,
      HOLIDAY: 0,
      pending: 0,
    };

    for (const row of rows) {
      if (!row.status) {
        result.pending += 1;
      } else {
        result[row.status as AttendanceStatus] += 1;
      }
    }

    return result;
  }, [rows]);

  const setAll = (status: AttendanceStatus) => {
    setRows((current) => current.map((row) => ({ ...row, status })));
    setSuccess("");
    setError("");
  };

  const updateStatus = (studentId: number, status: AttendanceStatus) => {
    setRows((current) =>
      current.map((row) =>
        row.student_id === studentId ? { ...row, status } : row
      )
    );
    setSuccess("");
  };

  const saveAttendance = async () => {
    if (!selectedSectionId) {
      setError("Please select a section before saving attendance.");
      return;
    }

    if (!rows.length) {
      setError("No active students are available in this section.");
      return;
    }

    const incomplete = rows.filter((row) => !row.status);
    if (incomplete.length > 0) {
      setError(
        `Attendance is incomplete. Please mark all ${incomplete.length} remaining student${
          incomplete.length === 1 ? "" : "s"
        }.`
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const saved = await apiFetch<AttendanceRow[]>(
        `/teacher/sections/${selectedSectionId}/attendance/bulk`,
        {
          method: "POST",
          body: JSON.stringify({
            date: attendanceDate,
            items: rows.map((row) => ({
              student_id: row.student_id,
              status: row.status,
            })),
          }),
        }
      );

      setRows(saved);
      setSuccess(
        `Attendance was recorded successfully for ${
          selectedSection?.class_name || "the selected class"
        } – ${selectedSection?.name || "section"} on ${displayDate(
          attendanceDate
        )}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save attendance. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingWorkspace) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="h-28 animate-pulse rounded-3xl bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
          <div className="h-[520px] animate-pulse rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
                Attendance Management
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#102a56] md:text-3xl">
                Daily Student Attendance
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Record and maintain attendance for students assigned to your
                sections. Select a date and complete the register before saving.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Section
                </span>
                <select
                  value={selectedSectionId}
                  onChange={(event) => setSelectedSectionId(event.target.value)}
                  className="min-w-[230px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#315b9b] focus:ring-2 focus:ring-[#315b9b]/10"
                >
                  {workspace?.sections.length ? (
                    workspace.sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.class_name} – {section.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No sections assigned</option>
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Attendance Date
                </span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(event) => setAttendanceDate(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#315b9b] focus:ring-2 focus:ring-[#315b9b]/10"
                />
              </label>
            </div>
          </div>

          {selectedSection ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                {selectedSection.class_name} – {selectedSection.name}
              </span>
              {selectedSection.is_class_teacher ? (
                <span className="rounded-full bg-[#102a56]/8 px-3 py-1.5 text-xs font-bold text-[#102a56]">
                  Class Teacher
                </span>
              ) : null}
              <span className="text-xs font-medium text-slate-400">
                {selectedSection.students.length} active students
              </span>
            </div>
          ) : null}
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total Students", counts.total, "Active section roster", "text-[#102a56]"],
            ["Present", counts.PRESENT, "Students marked present", "text-emerald-700"],
            ["Absent", counts.ABSENT, "Students marked absent", "text-red-700"],
            ["Pending", counts.pending, "Attendance not yet recorded", "text-[#102a56]"],
          ].map(([label, value, hint, valueClass]) => (
            <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {label}
              </div>
              <div className={`mt-2 text-3xl font-black ${valueClass}`}>
                {value}
              </div>
              <div className="mt-1 text-xs text-slate-500">{hint}</div>
            </div>
          ))}
        </section>

        {error ? (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="text-red-500 hover:text-red-700">
              ×
            </button>
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess("")} className="text-emerald-500 hover:text-emerald-700">
              ×
            </button>
          </div>
        ) : null}

        <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-lg font-black text-[#102a56]">
                  Student Attendance Register
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {displayDate(attendanceDate)} · Select one status for each
                  student and save the completed register.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ⌕
                  </span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search student or admission no."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#315b9b] focus:ring-2 focus:ring-[#315b9b]/10 sm:w-[260px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setAll("PRESENT")}
                  disabled={!rows.length || loadingAttendance}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark All Present
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <div key={option.value} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyle(option.value)}`}>
                  {option.short} · {option.label}
                </div>
              ))}
            </div>
          </div>

          {loadingAttendance ? (
            <div className="p-8">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">
                ✓
              </div>
              <h4 className="mt-4 text-base font-black text-slate-900">
                No students available
              </h4>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                No active students are available in the selected section for
                attendance recording.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="w-16 px-4 py-3 font-bold">#</th>
                      <th className="px-4 py-3 font-bold">Student</th>
                      <th className="px-4 py-3 font-bold">Admission Number</th>
                      <th className="px-4 py-3 text-center font-bold">
                        Attendance Status
                      </th>
                      <th className="px-4 py-3 text-right font-bold">
                        Current Record
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => (
                      <tr key={row.student_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#102a56]/8 text-xs font-black text-[#102a56]">
                              {studentInitials(row.student_name)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-900">
                                {row.student_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-600">
                          {row.admission_number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {STATUS_OPTIONS.map((option) => {
                              const selected = row.status === option.value;

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() =>
                                    updateStatus(row.student_id, option.value)
                                  }
                                  aria-label={`${row.student_name}: ${option.label}`}
                                  className={[
                                    "min-w-12 rounded-lg border px-2.5 py-2 text-[11px] font-black transition",
                                    selected
                                      ? `${statusStyle(option.value)} ring-2 ring-offset-1 ring-slate-300`
                                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                                  ].join(" ")}
                                >
                                  {option.short}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyle(row.status)}`}>
                            {STATUS_OPTIONS.find((option) => option.value === row.status)?.label || "Not Recorded"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRows.length === 0 ? (
                <div className="border-t border-slate-100 p-8 text-center text-sm text-slate-500">
                  No students match your search.
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 p-5 md:flex-row md:items-center md:justify-between md:p-6">
                <div className="text-xs leading-5 text-slate-500">
                  <span className="font-bold text-slate-700">
                    {counts.total - counts.pending}
                  </span>{" "}
                  of <span className="font-bold text-slate-700">{counts.total}</span>{" "}
                  students marked ·{" "}
                  <span className="font-bold text-slate-700">
                    {displayDate(attendanceDate)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void saveAttendance()}
                  disabled={saving || loadingAttendance}
                  className="rounded-xl bg-[#102a56] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#173b75] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving Attendance…" : "Save Attendance Register"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
