"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://127.0.0.1:8000";

type Teacher = {
  id: number;
  user_id?: number;
  employee_number?: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean;
};

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
};

type Subject = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active?: boolean;
};

type Assignment = {
  teacher_id: number;
  class_id: number;
  subject_id: number;
  teacher?: Teacher;
  school_class?: SchoolClass;
  class?: SchoolClass;
  subject?: Subject;
};

type AssignmentForm = {
  teacher_id: string;
  class_id: string;
  subject_id: string;
};

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === "object" && data !== null) {
    const value = data as {
      detail?: unknown;
      message?: unknown;
    };

    if (typeof value.detail === "string") {
      return value.detail;
    }

    if (Array.isArray(value.detail)) {
      return value.detail
        .map((item) => {
          if (
            typeof item === "object" &&
            item !== null &&
            "msg" in item
          ) {
            return String((item as { msg: unknown }).msg);
          }

          return String(item);
        })
        .join(", ");
    }

    if (typeof value.message === "string") {
      return value.message;
    }
  }

  return fallback;
}

function getTeacherName(teacher?: Teacher, teacherId?: number) {
  if (teacher) {
    return `${teacher.first_name} ${teacher.last_name}`.trim();
  }

  return teacherId ? `Teacher #${teacherId}` : "Unknown teacher";
}

function getClassName(
  schoolClass?: SchoolClass,
  classId?: number,
) {
  if (schoolClass?.name) {
    return schoolClass.name;
  }

  return classId ? `Class #${classId}` : "Unknown class";
}

function getSubjectName(
  subject?: Subject,
  subjectId?: number,
) {
  if (subject?.name) {
    return subject.code
      ? `${subject.name} (${subject.code})`
      : subject.name;
  }

  return subjectId ? `Subject #${subjectId}` : "Unknown subject";
}

export default function TeacherAssignmentsPage() {
  const router = useRouter();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<Assignment | null>(null);

  const [form, setForm] = useState<AssignmentForm>({
    teacher_id: "",
    class_id: "",
    subject_id: "",
  });

  const [formError, setFormError] = useState("");

  const getToken = () => {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem("access_token");
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const authHeaders = () => {
    const token = getToken();

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const fetchTeachers = async () => {
    const response = await fetch(`${API_BASE}/teachers/`, {
      headers: authHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, "Failed to load teachers"),
      );
    }

    return Array.isArray(data) ? data : [];
  };

  const fetchClasses = async () => {
    const response = await fetch(`${API_BASE}/classes/`, {
      headers: authHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, "Failed to load classes"),
      );
    }

    return Array.isArray(data) ? data : [];
  };

  const fetchSubjects = async () => {
    const response = await fetch(`${API_BASE}/subjects/`, {
      headers: authHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, "Failed to load subjects"),
      );
    }

    return Array.isArray(data) ? data : [];
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      const [teacherData, classData, subjectData] =
        await Promise.all([
          fetchTeachers(),
          fetchClasses(),
          fetchSubjects(),
        ]);

      setTeachers(teacherData);
      setClasses(classData);
      setSubjects(subjectData);

      if (teacherData.length > 0) {
        setForm((current) => ({
          ...current,
          teacher_id: current.teacher_id || String(teacherData[0].id),
        }));
      }
    } catch (err) {
      if (err instanceof Error && err.message === "Session expired") {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load teacher assignment data",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherAssignments = async (teacherId: string) => {
    if (!teacherId || teacherId === "all") {
      return [];
    }

    const response = await fetch(
      `${API_BASE}/teacher-assignments/teacher/${teacherId}`,
      {
        headers: authHeaders(),
      },
    );

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          "Failed to load teacher assignments",
        ),
      );
    }

    return Array.isArray(data) ? data : [];
  };

  const fetchAllAssignments = async (teacherList: Teacher[]) => {
    if (teacherList.length === 0) {
      setAssignments([]);
      return;
    }

    try {
      setLoadingAssignments(true);

      const responses = await Promise.all(
        teacherList.map(async (teacher) => {
          try {
            const data = await fetchTeacherAssignments(
              String(teacher.id),
            );

            return data;
          } catch {
            return [];
          }
        }),
      );

      const flattened = responses.flat();

      const unique = new Map<string, Assignment>();

      flattened.forEach((item) => {
        const key = `${item.teacher_id}-${item.class_id}-${item.subject_id}`;

        if (!unique.has(key)) {
          unique.set(key, item);
        }
      });

      setAssignments(Array.from(unique.values()));
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading && teachers.length > 0) {
      fetchAllAssignments(teachers);
    }
  }, [loading, teachers.length]);

  const teacherMap = useMemo(() => {
    return new Map(
      teachers.map((teacher) => [teacher.id, teacher]),
    );
  }, [teachers]);

  const classMap = useMemo(() => {
    return new Map(
      classes.map((schoolClass) => [
        schoolClass.id,
        schoolClass,
      ]),
    );
  }, [classes]);

  const subjectMap = useMemo(() => {
    return new Map(
      subjects.map((subject) => [subject.id, subject]),
    );
  }, [subjects]);

  const enrichedAssignments = useMemo(() => {
    return assignments.map((assignment) => ({
      ...assignment,
      teacher:
        assignment.teacher ||
        teacherMap.get(assignment.teacher_id),
      school_class:
        assignment.school_class ||
        assignment.class ||
        classMap.get(assignment.class_id),
      subject:
        assignment.subject ||
        subjectMap.get(assignment.subject_id),
    }));
  }, [
    assignments,
    teacherMap,
    classMap,
    subjectMap,
  ]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedAssignments.filter((assignment) => {
      const teacher = assignment.teacher;
      const schoolClass = assignment.school_class;
      const subject = assignment.subject;

      const teacherName = getTeacherName(
        teacher,
        assignment.teacher_id,
      ).toLowerCase();

      const className = getClassName(
        schoolClass,
        assignment.class_id,
      ).toLowerCase();

      const subjectName = getSubjectName(
        subject,
        assignment.subject_id,
      ).toLowerCase();

      const matchesSearch =
        !query ||
        teacherName.includes(query) ||
        className.includes(query) ||
        subjectName.includes(query);

      const matchesTeacher =
        teacherFilter === "all" ||
        String(assignment.teacher_id) === teacherFilter;

      return matchesSearch && matchesTeacher;
    });
  }, [
    enrichedAssignments,
    search,
    teacherFilter,
  ]);

  const stats = useMemo(() => {
    const uniqueTeachers = new Set(
      assignments.map((item) => item.teacher_id),
    );

    const uniqueClasses = new Set(
      assignments.map((item) => item.class_id),
    );

    const uniqueSubjects = new Set(
      assignments.map((item) => item.subject_id),
    );

    return {
      total: assignments.length,
      teachers: uniqueTeachers.size,
      classes: uniqueClasses.size,
      subjects: uniqueSubjects.size,
    };
  }, [assignments]);

  const refreshAssignments = async () => {
    try {
      setLoadingAssignments(true);
      setError("");

      if (teacherFilter !== "all") {
        const data = await fetchTeacherAssignments(
          teacherFilter,
        );

        setAssignments((current) => {
          const otherAssignments = current.filter(
            (item) =>
              String(item.teacher_id) !== teacherFilter,
          );

          const unique = new Map<string, Assignment>();

          [...otherAssignments, ...data].forEach((item) => {
            const key = `${item.teacher_id}-${item.class_id}-${item.subject_id}`;
            unique.set(key, item);
          });

          return Array.from(unique.values());
        });
      } else {
        await fetchAllAssignments(teachers);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "Session expired"
      ) {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Failed to refresh assignments",
      );
    } finally {
      setLoadingAssignments(false);
    }
  };

  const resetForm = () => {
    setForm({
      teacher_id:
        teachers.length > 0 ? String(teachers[0].id) : "",
      class_id:
        classes.length > 0 ? String(classes[0].id) : "",
      subject_id:
        subjects.length > 0 ? String(subjects[0].id) : "",
    });

    setFormError("");
  };

  const openAddModal = () => {
    resetForm();
    setError("");
    setSuccess("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (submitting) {
      return;
    }

    setShowAddModal(false);
    setFormError("");
  };

  const handleCreate = async () => {
    setFormError("");
    setError("");
    setSuccess("");

    if (!form.teacher_id) {
      setFormError("Please select a teacher.");
      return;
    }

    if (!form.class_id) {
      setFormError("Please select a class.");
      return;
    }

    if (!form.subject_id) {
      setFormError("Please select a subject.");
      return;
    }

    const alreadyExists = assignments.some(
      (assignment) =>
        assignment.teacher_id === Number(form.teacher_id) &&
        assignment.class_id === Number(form.class_id) &&
        assignment.subject_id === Number(form.subject_id),
    );

    if (alreadyExists) {
      setFormError(
        "This teacher is already assigned to this class and subject.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_BASE}/teacher-assignments/`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            teacher_id: Number(form.teacher_id),
            class_id: Number(form.class_id),
            subject_id: Number(form.subject_id),
          }),
        },
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Failed to create teacher assignment",
          ),
        );
      }

      const newAssignment: Assignment = {
        ...data,
        teacher_id:
          Number(data.teacher_id) ||
          Number(form.teacher_id),
        class_id:
          Number(data.class_id) ||
          Number(form.class_id),
        subject_id:
          Number(data.subject_id) ||
          Number(form.subject_id),
        teacher:
          data.teacher ||
          teacherMap.get(Number(form.teacher_id)),
        school_class:
          data.school_class ||
          data.class ||
          classMap.get(Number(form.class_id)),
        subject:
          data.subject ||
          subjectMap.get(Number(form.subject_id)),
      };

      setAssignments((current) => {
        const key = `${newAssignment.teacher_id}-${newAssignment.class_id}-${newAssignment.subject_id}`;

        const filtered = current.filter(
          (item) =>
            `${item.teacher_id}-${item.class_id}-${item.subject_id}` !==
            key,
        );

        return [...filtered, newAssignment];
      });

      setSuccess("Teacher assignment created successfully.");
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "Session expired"
      ) {
        return;
      }

      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to create teacher assignment",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_BASE}/teacher-assignments/${deleteTarget.teacher_id}/${deleteTarget.class_id}/${deleteTarget.subject_id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Failed to delete teacher assignment",
          ),
        );
      }

      setAssignments((current) =>
        current.filter(
          (item) =>
            !(
              item.teacher_id === deleteTarget.teacher_id &&
              item.class_id === deleteTarget.class_id &&
              item.subject_id === deleteTarget.subject_id
            ),
        ),
      );

      setDeleteTarget(null);
      setSuccess("Teacher assignment removed successfully.");
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "Session expired"
      ) {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete teacher assignment",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleTeacherFilterChange = async (
    value: string,
  ) => {
    setTeacherFilter(value);
    setSearch("");
    setError("");

    if (value === "all") {
      await fetchAllAssignments(teachers);
      return;
    }

    try {
      setLoadingAssignments(true);

      const data = await fetchTeacherAssignments(value);

      setAssignments((current) => {
        const otherAssignments = current.filter(
          (item) => String(item.teacher_id) !== value,
        );

        return [...otherAssignments, ...data];
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "Session expired"
      ) {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load teacher assignments",
      );
    } finally {
      setLoadingAssignments(false);
    }
  };

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-sm font-medium text-slate-400 transition hover:text-[#102A56]"
              >
                Dashboard
              </button>

              <span className="text-slate-300">/</span>

              <span className="text-sm font-medium text-slate-600">
                Teacher Assignments
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              Teacher Assignments
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage teacher, class and subject teaching mappings.
            </p>
          </div>

          <button
            onClick={openAddModal}
            disabled={
              teachers.length === 0 ||
              classes.length === 0 ||
              subjects.length === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#17386f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-lg leading-none">+</span>
            New Assignment
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div>
              <p className="font-semibold">
                Something went wrong
              </p>
              <p className="mt-0.5">{error}</p>
            </div>

            <button
              onClick={clearMessages}
              className="font-bold text-red-400 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div>
              <p className="font-semibold">Success</p>
              <p className="mt-0.5">{success}</p>
            </div>

            <button
              onClick={clearMessages}
              className="font-bold text-emerald-400 hover:text-emerald-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Assignments
            </p>

            <p className="mt-2 text-2xl font-bold text-[#102A56]">
              {stats.total}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Active mappings
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Teachers
            </p>

            <p className="mt-2 text-2xl font-bold text-[#102A56]">
              {stats.teachers}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Assigned teachers
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Classes
            </p>

            <p className="mt-2 text-2xl font-bold text-[#102A56]">
              {stats.classes}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Covered classes
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Subjects
            </p>

            <p className="mt-2 text-2xl font-bold text-[#102A56]">
              {stats.subjects}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Teaching subjects
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-xl">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌕
                </span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search teacher, class or subject..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={teacherFilter}
                  onChange={(event) =>
                    handleTeacherFilterChange(
                      event.target.value,
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="all">
                    All Teachers
                  </option>

                  {teachers.map((teacher) => (
                    <option
                      key={teacher.id}
                      value={teacher.id}
                    >
                      {getTeacherName(teacher)}
                    </option>
                  ))}
                </select>

                <button
                  onClick={refreshAssignments}
                  disabled={loadingAssignments}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingAssignments
                    ? "Refreshing..."
                    : "Refresh"}
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="p-10">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-xl border border-slate-100 p-4"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div className="h-5 rounded bg-slate-100" />
                      <div className="h-5 rounded bg-slate-100" />
                      <div className="h-5 rounded bg-slate-100" />
                      <div className="h-5 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading &&
            filteredAssignments.length === 0 && (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#102A56]">
                  ◇
                </div>

                <h3 className="mt-5 text-lg font-bold text-[#102A56]">
                  No teacher assignments found
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {search || teacherFilter !== "all"
                    ? "Try changing your search or teacher filter."
                    : "Create a teacher assignment to connect a teacher with a class and subject."}
                </p>

                {!search &&
                  teacherFilter === "all" && (
                    <button
                      onClick={openAddModal}
                      disabled={
                        teachers.length === 0 ||
                        classes.length === 0 ||
                        subjects.length === 0
                      }
                      className="mt-5 rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#17386f] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Create First Assignment
                    </button>
                  )}
              </div>
            )}

          {/* Desktop table */}
          {!loading &&
            filteredAssignments.length > 0 && (
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[850px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Teacher
                      </th>

                      <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Class
                      </th>

                      <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Subject
                      </th>

                      <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Assignment ID
                      </th>

                      <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredAssignments.map(
                      (assignment) => {
                        const teacher =
                          assignment.teacher;
                        const schoolClass =
                          assignment.school_class;
                        const subject =
                          assignment.subject;

                        return (
                          <tr
                            key={`${assignment.teacher_id}-${assignment.class_id}-${assignment.subject_id}`}
                            className="transition hover:bg-slate-50/60"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-[#102A56]">
                                  {teacher
                                    ? `${teacher.first_name?.[0] ?? ""}${teacher.last_name?.[0] ?? ""}`
                                    : "T"}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">
                                    {getTeacherName(
                                      teacher,
                                      assignment.teacher_id,
                                    )}
                                  </p>

                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {teacher?.employee_number ||
                                      `Teacher ID: ${assignment.teacher_id}`}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="inline-flex rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                                {getClassName(
                                  schoolClass,
                                  assignment.class_id,
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">
                                  {subject?.name ||
                                    `Subject #${assignment.subject_id}`}
                                </p>

                                {subject?.code && (
                                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                                    {subject.code}
                                  </p>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <span className="rounded-lg bg-blue-50 px-3 py-2 font-mono text-xs font-semibold text-blue-700">
                                {assignment.teacher_id}-
                                {assignment.class_id}-
                                {assignment.subject_id}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() =>
                                  setDeleteTarget(
                                    assignment,
                                  )
                                }
                                className="rounded-lg px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-600"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}

          {/* Mobile cards */}
          {!loading &&
            filteredAssignments.length > 0 && (
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredAssignments.map(
                  (assignment) => {
                    const teacher =
                      assignment.teacher;
                    const schoolClass =
                      assignment.school_class;
                    const subject =
                      assignment.subject;

                    return (
                      <div
                        key={`${assignment.teacher_id}-${assignment.class_id}-${assignment.subject_id}`}
                        className="p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-[#102A56]">
                              {teacher
                                ? `${teacher.first_name?.[0] ?? ""}${teacher.last_name?.[0] ?? ""}`
                                : "T"}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800">
                                {getTeacherName(
                                  teacher,
                                  assignment.teacher_id,
                                )}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {teacher?.employee_number ||
                                  `Teacher ID: ${assignment.teacher_id}`}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              setDeleteTarget(
                                assignment,
                              )
                            }
                            className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Class
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {getClassName(
                                schoolClass,
                                assignment.class_id,
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Subject
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {subject?.name ||
                                `Subject #${assignment.subject_id}`}
                            </p>

                            {subject?.code && (
                              <p className="mt-0.5 text-xs text-slate-400">
                                {subject.code}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Assignment ID
                          </p>

                          <p className="mt-1 font-mono text-xs font-semibold text-slate-600">
                            {assignment.teacher_id}-
                            {assignment.class_id}-
                            {assignment.subject_id}
                          </p>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}

          {/* Footer */}
          {!loading &&
            filteredAssignments.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                <p className="text-xs font-medium text-slate-400">
                  Showing{" "}
                  <span className="font-bold text-slate-600">
                    {filteredAssignments.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-slate-600">
                    {assignments.length}
                  </span>{" "}
                  assignments
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-500">
                    New Mapping
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#102A56]">
                    Assign Teacher
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Connect one teacher with a class and subject.
                  </p>
                </div>

                <button
                  onClick={closeAddModal}
                  disabled={submitting}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Teacher
                </label>

                <select
                  value={form.teacher_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      teacher_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">
                    Select teacher
                  </option>

                  {teachers.map((teacher) => (
                    <option
                      key={teacher.id}
                      value={teacher.id}
                    >
                      {getTeacherName(teacher)}
                      {teacher.employee_number
                        ? ` • ${teacher.employee_number}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Class
                </label>

                <select
                  value={form.class_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      class_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">
                    Select class
                  </option>

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

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Subject
                </label>

                <select
                  value={form.subject_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      subject_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">
                    Select subject
                  </option>

                  {subjects.map((subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.name}
                      {subject.code
                        ? ` • ${subject.code}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold text-blue-700">
                  Assignment mapping
                </p>

                <p className="mt-1 text-sm text-blue-600">
                  {form.teacher_id &&
                  form.class_id &&
                  form.subject_id
                    ? `${
                        getTeacherName(
                          teacherMap.get(
                            Number(form.teacher_id),
                          ),
                        )
                      } → ${
                        classMap.get(
                          Number(form.class_id),
                        )?.name || "Class"
                      } → ${
                        subjectMap.get(
                          Number(form.subject_id),
                        )?.name || "Subject"
                      }`
                    : "Select all three fields to preview the mapping."}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:justify-end sm:px-6">
              <button
                onClick={closeAddModal}
                disabled={submitting}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleCreate}
                disabled={submitting}
                className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#17386f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Creating..."
                  : "Create Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-500">
                !
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#102A56]">
                Remove assignment?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                This will remove the teaching assignment between{" "}
                <span className="font-semibold text-slate-700">
                  {getTeacherName(
                    deleteTarget.teacher,
                    deleteTarget.teacher_id,
                  )}
                </span>
                ,{" "}
                <span className="font-semibold text-slate-700">
                  {getClassName(
                    deleteTarget.school_class,
                    deleteTarget.class_id,
                  )}
                </span>{" "}
                and{" "}
                <span className="font-semibold text-slate-700">
                  {deleteTarget.subject?.name ||
                    `Subject #${deleteTarget.subject_id}`}
                </span>
                .
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting
                  ? "Removing..."
                  : "Remove Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}