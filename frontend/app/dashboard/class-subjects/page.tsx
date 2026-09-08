"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Subject = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Authentication required. Please login again.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function getErrorMessage(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: any) => item?.msg || "Validation error")
        .join(", ");
    }

    return "Something went wrong.";
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export default function ClassSubjectsPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedClass = classes.find(
    (item) => item.id === Number(selectedClassId)
  );

  const assignedSubjectIds = useMemo(
    () => new Set(assignedSubjects.map((subject) => subject.id)),
    [assignedSubjects]
  );

  const availableSubjects = useMemo(() => {
    return subjects.filter(
      (subject) =>
        subject.is_active !== false && !assignedSubjectIds.has(subject.id)
    );
  }, [subjects, assignedSubjectIds]);

  const filteredAssignedSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return assignedSubjects;
    }

    return assignedSubjects.filter(
      (subject) =>
        subject.name.toLowerCase().includes(query) ||
        subject.code.toLowerCase().includes(query) ||
        (subject.description || "").toLowerCase().includes(query)
    );
  }, [assignedSubjects, search]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError("");

    try {
      const headers = getAuthHeaders();

      const [classesResponse, subjectsResponse] = await Promise.all([
        fetch(`${API_BASE}/classes/`, {
          headers,
        }),
        fetch(`${API_BASE}/subjects/`, {
          headers,
        }),
      ]);

      if (!classesResponse.ok) {
        throw new Error(await getErrorMessage(classesResponse));
      }

      if (!subjectsResponse.ok) {
        throw new Error(await getErrorMessage(subjectsResponse));
      }

      const classesData: SchoolClass[] = await classesResponse.json();
      const subjectsData: Subject[] = await subjectsResponse.json();

      setClasses(classesData.filter((item) => item.is_active));
      setSubjects(subjectsData.filter((item) => item.is_active !== false));

      if (classesData.length > 0) {
        const firstActiveClass =
          classesData.find((item) => item.is_active) || classesData[0];

        setSelectedClassId(String(firstActiveClass.id));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load data.";

      setError(message);

      if (
        message.toLowerCase().includes("authentication") ||
        message.toLowerCase().includes("token")
      ) {
        setTimeout(() => {
          window.location.href = "/login";
        }, 800);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedSubjects = async (classId: string) => {
    if (!classId) {
      setAssignedSubjects([]);
      return;
    }

    setLoadingAssigned(true);
    setError("");

    try {
      const headers = getAuthHeaders();

      const response = await fetch(
        `${API_BASE}/classes/${classId}/subjects`,
        {
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data: Subject[] = await response.json();
      setAssignedSubjects(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load class subjects.";

      setError(message);
      setAssignedSubjects([]);
    } finally {
      setLoadingAssigned(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      setSearch("");
      setSelectedSubjectId("");
      fetchAssignedSubjects(selectedClassId);
    }
  }, [selectedClassId]);

  const handleAssignSubject = async () => {
    if (!selectedClassId || !selectedSubjectId) {
      setError("Please select both a class and a subject.");
      return;
    }

    setAssigning(true);
    setError("");
    setSuccess("");

    try {
      const headers = getAuthHeaders();

      const response = await fetch(
        `${API_BASE}/classes/${selectedClassId}/subjects/${selectedSubjectId}`,
        {
          method: "POST",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const assignedSubject = subjects.find(
        (subject) => subject.id === Number(selectedSubjectId)
      );

      setSelectedSubjectId("");

      await fetchAssignedSubjects(selectedClassId);

      setSuccess(
        assignedSubject
          ? `${assignedSubject.name} assigned to ${selectedClass?.name}.`
          : "Subject assigned successfully."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to assign subject.";

      setError(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveSubject = async (subject: Subject) => {
    if (!selectedClassId) {
      return;
    }

    const confirmed = window.confirm(
      `Remove "${subject.name}" from ${selectedClass?.name || "this class"}?`
    );

    if (!confirmed) {
      return;
    }

    setRemovingId(subject.id);
    setError("");
    setSuccess("");

    try {
      const headers = getAuthHeaders();

      const response = await fetch(
        `${API_BASE}/classes/${selectedClassId}/subjects/${subject.id}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await fetchAssignedSubjects(selectedClassId);

      setSuccess(`${subject.name} removed from the class.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove subject.";

      setError(message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleRefresh = async () => {
    setSuccess("");
    setError("");

    if (selectedClassId) {
      await fetchAssignedSubjects(selectedClassId);
    }

    try {
      const headers = getAuthHeaders();

      const response = await fetch(`${API_BASE}/subjects/`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data: Subject[] = await response.json();
      setSubjects(data.filter((item) => item.is_active !== false));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh subjects.";

      setError(message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#f5f7fb] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
            <div className="mt-3 h-4 w-80 animate-pulse rounded bg-slate-200" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="h-72 animate-pulse rounded-3xl bg-white shadow-sm" />
            <div className="h-72 animate-pulse rounded-3xl bg-white shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f5f7fb]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Header */}
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#102A56]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Academic Configuration
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              Class Subjects
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage which subjects are assigned to each class. Assign new
              subjects or remove existing class-subject mappings.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loadingAssigned}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#102A56] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className={loadingAssigned ? "animate-spin" : ""}>↻</span>
            Refresh
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold">
              !
            </span>

            <div className="flex-1">
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-0.5 text-red-600">{error}</p>
            </div>

            <button
              onClick={() => setError("")}
              className="text-red-400 transition hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold">
              ✓
            </span>

            <div className="flex-1">
              <p className="font-semibold">Success</p>
              <p className="mt-0.5 text-emerald-600">{success}</p>
            </div>

            <button
              onClick={() => setSuccess("")}
              className="text-emerald-400 transition hover:text-emerald-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Classes
            </p>
            <p className="mt-2 text-2xl font-bold text-[#102A56]">
              {classes.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Available for configuration
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Subjects
            </p>
            <p className="mt-2 text-2xl font-bold text-[#102A56]">
              {subjects.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Active subjects in EduOS
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Assigned Subjects
            </p>
            <p className="mt-2 text-2xl font-bold text-[#102A56]">
              {assignedSubjects.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              For selected class
            </p>
          </div>
        </div>

        {/* Main workspace */}
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Left panel */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-br from-[#102A56] to-[#173d78] p-6 text-white">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl backdrop-blur">
                ◇
              </div>

              <h2 className="mt-5 text-lg font-bold">Assign Subject</h2>

              <p className="mt-1 text-sm leading-6 text-blue-100">
                Select a class and assign an available subject to it.
              </p>
            </div>

            <div className="space-y-5 p-6">
              {/* Class */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Class
                </label>

                <select
                  value={selectedClassId}
                  onChange={(event) =>
                    setSelectedClassId(event.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">Choose a class</option>

                  {classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected class */}
              {selectedClass && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-500">
                    Selected Class
                  </p>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102A56] text-sm font-bold text-white">
                      {selectedClass.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <p className="font-bold text-[#102A56]">
                        {selectedClass.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {selectedClass.description || "No description"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Subject
                </label>

                <select
                  value={selectedSubjectId}
                  onChange={(event) =>
                    setSelectedSubjectId(event.target.value)
                  }
                  disabled={!selectedClassId || availableSubjects.length === 0}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {!selectedClassId
                      ? "Select a class first"
                      : availableSubjects.length === 0
                        ? "All subjects assigned"
                        : "Choose a subject"}
                  </option>

                  {availableSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign button */}
              <button
                onClick={handleAssignSubject}
                disabled={
                  !selectedClassId ||
                  !selectedSubjectId ||
                  assigning
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#102A56] px-4 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#0b2145] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {assigning ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <span className="text-lg">+</span>
                    Assign Subject
                  </>
                )}
              </button>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                Subject assignment is saved directly through the EduOS class
                subject API.
              </div>
            </div>
          </section>

          {/* Right panel */}
          <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Current Mapping
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#102A56]">
                    {selectedClass
                      ? `${selectedClass.name} Subjects`
                      : "Assigned Subjects"}
                  </h2>
                </div>

                <div className="flex h-11 min-w-[72px] items-center justify-center rounded-xl bg-blue-50 px-4 text-sm font-bold text-[#102A56]">
                  {assignedSubjects.length}
                </div>
              </div>

              <div className="relative mt-5">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌕
                </span>

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search assigned subjects..."
                  disabled={!selectedClassId}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {!selectedClassId ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                    ▤
                  </div>

                  <h3 className="mt-4 font-bold text-[#102A56]">
                    Select a class
                  </h3>

                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    Choose a class from the left panel to view its assigned
                    subjects.
                  </p>
                </div>
              ) : loadingAssigned ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-2xl bg-slate-100"
                    />
                  ))}
                </div>
              ) : filteredAssignedSubjects.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                    ◇
                  </div>

                  <h3 className="mt-4 font-bold text-[#102A56]">
                    {search
                      ? "No subjects found"
                      : "No subjects assigned yet"}
                  </h3>

                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    {search
                      ? "Try another subject name or code."
                      : "Use the assignment panel to add subjects to this class."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAssignedSubjects.map((subject, index) => (
                    <div
                      key={subject.id}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102A56] text-sm font-bold text-white">
                          {subject.code.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-bold text-[#102A56]">
                              {subject.name}
                            </h3>

                            <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                              {subject.code}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {subject.description || "No description available"}
                          </p>
                        </div>

                        <div className="hidden text-right sm:block">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Subject
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            #{index + 1}
                          </p>
                        </div>

                        <button
                          onClick={() => handleRemoveSubject(subject)}
                          disabled={removingId === subject.id}
                          title="Remove subject"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-sm font-bold text-red-500 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {removingId === subject.id ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
                          ) : (
                            "×"
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Bottom info */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                ✓
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Class-subject mapping is live
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Changes are persisted through the backend API immediately.
                </p>
              </div>
            </div>

            <div className="text-xs font-medium text-slate-400">
              EduOS Academic Management
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}