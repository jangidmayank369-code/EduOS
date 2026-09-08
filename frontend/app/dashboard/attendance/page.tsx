"use client";

import { useEffect, useMemo, useState } from "react";

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
  class_id: number | null;
  is_active: boolean;
};

type AttendanceRecord = {
  id: number;
  student_id: number;
  date: string;
  status: string;
  marked_by: number;
  created_at: string;
};

type AttendanceStatus = "present" | "absent";

const API_BASE = "http://127.0.0.1:8000";

export default function AttendancePage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [attendance, setAttendance] = useState<
    Record<number, AttendanceStatus>
  >({});

  const [existingRecords, setExistingRecords] = useState<
    Record<number, AttendanceRecord>
  >({});

  const [loading, setLoading] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === Number(selectedClassId)),
    [classes, selectedClassId]
  );

  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];

    return students.filter(
      (student) =>
        student.class_id === Number(selectedClassId) &&
        student.is_active
    );
  }, [students, selectedClassId]);

  const presentCount = classStudents.filter(
    (student) => attendance[student.id] === "present"
  ).length;

  const absentCount = classStudents.filter(
    (student) => attendance[student.id] === "absent"
  ).length;

  const alreadyMarkedCount = classStudents.filter(
    (student) => existingRecords[student.id]
  ).length;

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setAttendance({});
      setExistingRecords({});
      return;
    }

    loadClassAttendance();
  }, [selectedClassId, selectedDate]);

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    window.location.href = "/login";
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError("");

    try {
      const [classesResponse, studentsResponse] = await Promise.all([
        fetch(`${API_BASE}/classes`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${API_BASE}/students`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (
        classesResponse.status === 401 ||
        studentsResponse.status === 401
      ) {
        handleUnauthorized();
        return;
      }

      if (!classesResponse.ok) {
        throw new Error("Failed to fetch classes");
      }

      if (!studentsResponse.ok) {
        throw new Error("Failed to fetch students");
      }

      const classesData = await classesResponse.json();
      const studentsData = await studentsResponse.json();

      setClasses(classesData);
      setStudents(studentsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance data"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadClassAttendance = async () => {
    if (!selectedClassId) return;

    setLoadingAttendance(true);
    setError("");
    setSuccess("");

    try {
      const classStudentsForLookup = students.filter(
        (student) =>
          student.class_id === Number(selectedClassId) &&
          student.is_active
      );

      if (classStudentsForLookup.length === 0) {
        setAttendance({});
        setExistingRecords({});
        return;
      }

      const results = await Promise.all(
        classStudentsForLookup.map(async (student) => {
          const response = await fetch(
            `${API_BASE}/attendance/student/${student.id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.status === 401) {
            handleUnauthorized();
            return {
              studentId: student.id,
              records: [] as AttendanceRecord[],
            };
          }

          if (!response.ok) {
            return {
              studentId: student.id,
              records: [] as AttendanceRecord[],
            };
          }

          const data = await response.json();

          return {
            studentId: student.id,
            records: data as AttendanceRecord[],
          };
        })
      );

      const recordsMap: Record<number, AttendanceRecord> = {};
      const statusMap: Record<number, AttendanceStatus> = {};

      results.forEach(({ studentId, records }) => {
        const record = records.find(
          (item) => item.date === selectedDate
        );

        if (record) {
          recordsMap[studentId] = record;

          const normalizedStatus = record.status.toLowerCase();

          if (
            normalizedStatus === "present" ||
            normalizedStatus === "absent"
          ) {
            statusMap[studentId] = normalizedStatus;
          }
        }
      });

      setExistingRecords(recordsMap);
      setAttendance(statusMap);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance"
      );
    } finally {
      setLoadingAttendance(false);
    }
  };

  const setStudentStatus = (
    studentId: number,
    status: AttendanceStatus
  ) => {
    if (existingRecords[studentId]) return;

    setAttendance((previous) => ({
      ...previous,
      [studentId]: status,
    }));

    setError("");
    setSuccess("");
  };

  const markAll = (status: AttendanceStatus) => {
    const updated = { ...attendance };

    classStudents.forEach((student) => {
      if (!existingRecords[student.id]) {
        updated[student.id] = status;
      }
    });

    setAttendance(updated);
    setError("");
    setSuccess("");
  };

  const submitAttendance = async () => {
    if (!selectedClassId) {
      setError("Please select a class first.");
      return;
    }

    if (classStudents.length === 0) {
      setError("No active students found in this class.");
      return;
    }

    const unmarkedStudents = classStudents.filter(
      (student) =>
        !existingRecords[student.id] && !attendance[student.id]
    );

    if (unmarkedStudents.length > 0) {
      setError(
        `Please mark attendance for all ${unmarkedStudents.length} remaining student${
          unmarkedStudents.length === 1 ? "" : "s"
        }.`
      );
      return;
    }

    const studentsToSubmit = classStudents.filter(
      (student) => !existingRecords[student.id]
    );

    if (studentsToSubmit.length === 0) {
      setError("Attendance is already marked for all students.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const results = await Promise.all(
        studentsToSubmit.map(async (student) => {
          const response = await fetch(`${API_BASE}/attendance/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              student_id: student.id,
              date: selectedDate,
              status: attendance[student.id],
            }),
          });

          if (response.status === 401) {
            handleUnauthorized();
            throw new Error("Session expired");
          }

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(
              data?.detail ||
                `Failed to mark attendance for ${student.first_name} ${student.last_name}`
            );
          }

          return data as AttendanceRecord;
        })
      );

      const newRecords = { ...existingRecords };

      results.forEach((record) => {
        newRecords[record.student_id] = record;
      });

      setExistingRecords(newRecords);

      setSuccess(
        `Attendance marked successfully for ${results.length} student${
          results.length === 1 ? "" : "s"
        }.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark attendance"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-72 rounded-xl bg-slate-200" />
            <div className="h-5 w-96 rounded-lg bg-slate-200" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-28 rounded-2xl bg-white shadow-sm"
                />
              ))}
            </div>

            <div className="h-[500px] rounded-3xl bg-white shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#102A56]">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Daily Attendance
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#102A56]">
              Attendance
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Mark and manage daily student attendance class by class.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Attendance Date
            </p>
            <p className="mt-1 text-sm font-bold text-[#102A56]">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }
              )}
            </p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-100 font-bold">
              !
            </span>

            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-0.5 text-red-600">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold">
              ✓
            </span>

            <div>
              <p className="font-semibold">Attendance saved</p>
              <p className="mt-0.5 text-emerald-600">{success}</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_220px_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Select Class
              </label>

              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setError("");
                  setSuccess("");
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                <option value="">Choose a class</option>

                {classes
                  .filter((item) => item.is_active)
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

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Attendance Date
              </label>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setError("");
                  setSuccess("");
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => markAll("present")}
                disabled={
                  !selectedClassId ||
                  classStudents.length === 0 ||
                  loadingAttendance
                }
                className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                All Present
              </button>

              <button
                type="button"
                onClick={() => markAll("absent")}
                disabled={
                  !selectedClassId ||
                  classStudents.length === 0 ||
                  loadingAttendance
                }
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                All Absent
              </button>
            </div>
          </div>

          {selectedClass && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-bold text-[#102A56] shadow-sm">
                  {selectedClass.name.replace("Class ", "").slice(0, 2)}
                </div>

                <div>
                  <p className="font-semibold text-[#102A56]">
                    {selectedClass.name}
                  </p>

                  <p className="text-xs text-slate-500">
                    {classStudents.length} active student
                    {classStudents.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="text-xs font-medium text-blue-700">
                {alreadyMarkedCount} already marked
              </div>
            </div>
          )}
        </section>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Total Students
            </p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-bold text-[#102A56]">
                {classStudents.length}
              </p>

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm text-[#102A56]">
                ♙
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Present
            </p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-bold text-emerald-600">
                {presentCount}
              </p>

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-sm text-emerald-700">
                ✓
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Absent
            </p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-bold text-red-600">
                {absentCount}
              </p>

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-sm text-red-700">
                !
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Marked
            </p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-bold text-indigo-600">
                {alreadyMarkedCount}
              </p>

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-700">
                ◉
              </span>
            </div>
          </div>
        </div>

        {/* Student attendance table */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#102A56]">
                  Student Attendance
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {selectedClass
                    ? `Mark attendance for ${selectedClass.name}`
                    : "Select a class to begin"}
                </p>
              </div>

              {selectedClassId && classStudents.length > 0 && (
                <div className="text-xs font-medium text-slate-400">
                  {presentCount + absentCount}/{classStudents.length} marked
                  in form
                </div>
              )}
            </div>
          </div>

          {!selectedClassId ? (
            <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#102A56]">
                ✓
              </div>

              <h3 className="font-semibold text-[#102A56]">
                Select a class
              </h3>

              <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                Choose a class and attendance date above to load the
                students.
              </p>
            </div>
          ) : loadingAttendance ? (
            <div className="space-y-3 p-5 sm:p-6">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-200" />

                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 rounded bg-slate-200" />
                      <div className="h-3 w-32 rounded bg-slate-200" />
                    </div>

                    <div className="h-9 w-24 rounded-lg bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : classStudents.length === 0 ? (
            <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                ♙
              </div>

              <h3 className="font-semibold text-[#102A56]">
                No students found
              </h3>

              <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                There are no active students assigned to this class.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Student
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Admission No.
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Attendance
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {classStudents.map((student, index) => {
                      const currentStatus = attendance[student.id];
                      const existing = existingRecords[student.id];

                      return (
                        <tr
                          key={student.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#102A56] text-xs font-bold text-white">
                                {student.first_name.charAt(0)}
                                {student.last_name.charAt(0)}
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-[#102A56]">
                                  {student.first_name}{" "}
                                  {student.last_name}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  Student #{index + 1}
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
                            {existing ? (
                              <span
                                className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
                                  existing.status.toLowerCase() ===
                                  "present"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {existing.status}
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                                Not submitted
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={!!existing}
                                onClick={() =>
                                  setStudentStatus(
                                    student.id,
                                    "present"
                                  )
                                }
                                className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                                  currentStatus === "present"
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                Present
                              </button>

                              <button
                                type="button"
                                disabled={!!existing}
                                onClick={() =>
                                  setStudentStatus(
                                    student.id,
                                    "absent"
                                  )
                                }
                                className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                                  currentStatus === "absent"
                                    ? "bg-red-600 text-white shadow-sm"
                                    : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {classStudents.map((student, index) => {
                  const currentStatus = attendance[student.id];
                  const existing = existingRecords[student.id];

                  return (
                    <div
                      key={student.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102A56] text-xs font-bold text-white">
                          {student.first_name.charAt(0)}
                          {student.last_name.charAt(0)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#102A56]">
                            {student.first_name} {student.last_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {student.admission_number}
                          </p>
                        </div>

                        {existing && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${
                              existing.status.toLowerCase() ===
                              "present"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {existing.status}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!!existing}
                          onClick={() =>
                            setStudentStatus(
                              student.id,
                              "present"
                            )
                          }
                          className={`rounded-xl px-3 py-3 text-xs font-bold transition ${
                            currentStatus === "present"
                              ? "bg-emerald-600 text-white"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          ✓ Present
                        </button>

                        <button
                          type="button"
                          disabled={!!existing}
                          onClick={() =>
                            setStudentStatus(
                              student.id,
                              "absent"
                            )
                          }
                          className={`rounded-xl px-3 py-3 text-xs font-bold transition ${
                            currentStatus === "absent"
                              ? "bg-red-600 text-white"
                              : "border border-red-200 bg-red-50 text-red-700"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          ! Absent
                        </button>
                      </div>

                      {!existing && (
                        <p className="mt-3 text-center text-[10px] font-medium text-slate-400">
                          Student {index + 1} · Not submitted yet
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#102A56]">
                      Ready to submit?
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {alreadyMarkedCount > 0
                        ? `${alreadyMarkedCount} attendance record${
                            alreadyMarkedCount === 1 ? "" : "s"
                          } already saved.`
                        : "Review all students before submitting."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={submitAttendance}
                    disabled={
                      submitting ||
                      classStudents.length === 0 ||
                      classStudents.every(
                        (student) => !!existingRecords[student.id]
                      )
                    }
                    className="rounded-xl bg-[#102A56] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#0c2145] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Saving Attendance...
                      </span>
                    ) : (
                      "Submit Attendance"
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
