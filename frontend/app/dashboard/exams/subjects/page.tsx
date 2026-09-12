"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type Subject = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type SubjectForm = {
  name: string;
  code: string;
  description: string;
};

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
};

type ClassSubject = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
};

type ComponentType = "MARKS" | "GRADE" | "REMARK";

type CoScholasticComponent = {
  id: number;
  class_id: number;
  name: string;
  component_type: ComponentType;
  max_marks: number | null;
  include_in_result: boolean;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type ComponentForm = {
  name: string;
  component_type: ComponentType;
  max_marks: string;
  include_in_result: boolean;
  display_order: string;
  class_id: string;
};

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
  message?: string;
};

function getErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const data = body as ApiErrorBody;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail
      .map((item) => item?.msg || "Validation error")
      .join(", ");
  }
  if (typeof data.message === "string") return data.message;
  return fallback;
}

export default function SubjectsPage() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [classesLoading, setClassesLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const [showForm, setShowForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showAssignments, setShowAssignments] = useState(false);
  const [assignmentSubject, setAssignmentSubject] = useState<Subject | null>(
    null
  );
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assignedSubjects, setAssignedSubjects] = useState<ClassSubject[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const [showComponents, setShowComponents] = useState(false);
  const [componentSubject, setComponentSubject] = useState<Subject | null>(
    null
  );
  const [componentClassId, setComponentClassId] = useState("");
  const [components, setComponents] = useState<CoScholasticComponent[]>([]);
  const [componentLoading, setComponentLoading] = useState(false);
  const [componentSubmitting, setComponentSubmitting] = useState(false);
  const [editingComponent, setEditingComponent] =
    useState<CoScholasticComponent | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<SubjectForm>({
    name: "",
    code: "",
    description: "",
  });

  const [componentForm, setComponentForm] = useState<ComponentForm>({
    name: "",
    component_type: "GRADE",
    max_marks: "",
    include_in_result: false,
    display_order: "0",
    class_id: "",
  });

  const token = () =>
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  }, [router]);

  const request = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const accessToken = token();
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...(options?.body ? { "Content-Type": "application/json" } : {}),
          Authorization: `Bearer ${accessToken ?? ""}`,
          ...(options?.headers ?? {}),
        },
      });

      if (response.status === 401) {
        logout();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = null;
        }
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `Request failed with status ${response.status}`)
        );
      }

      return (body ?? {}) as T;
    },
    [logout]
  );

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request<Subject[]>("/subjects/");
      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load subjects.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  const fetchClasses = useCallback(async () => {
    setClassesLoading(true);
    try {
      const data = await request<SchoolClass[]>("/classes/");
      setClasses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to load classes."
      );
    } finally {
      setClassesLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const accessToken = token();
    if (!accessToken) {
      router.push("/login");
      return;
    }
    void fetchSubjects();
    void fetchClasses();
  }, [fetchClasses, fetchSubjects, router]);

  const activeSubjects = subjects.filter((subject) => subject.is_active).length;
  const inactiveSubjects = subjects.length - activeSubjects;

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return subjects.filter((subject) => {
      const matchesSearch =
        !query ||
        subject.name.toLowerCase().includes(query) ||
        subject.code.toLowerCase().includes(query) ||
        (subject.description ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && subject.is_active) ||
        (statusFilter === "inactive" && !subject.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [subjects, search, statusFilter]);

  const resetSubjectForm = () => {
    setForm({ name: "", code: "", description: "" });
    setEditingSubject(null);
  };

  const openCreate = () => {
    setError("");
    setSuccess("");
    resetSubjectForm();
    setShowForm(true);
  };

  const openEdit = (subject: Subject) => {
    setError("");
    setSuccess("");
    setEditingSubject(subject);
    setForm({
      name: subject.name,
      code: subject.code,
      description: subject.description ?? "",
    });
    setShowForm(true);
  };

  const handleSubjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();

    if (!name || !code) {
      setError("Subject name and code are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editingSubject) {
        await request<Subject>(`/subjects/${editingSubject.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name,
            code,
            description: form.description.trim() || null,
          }),
        });
        setSuccess("Subject updated successfully.");
      } else {
        await request<Subject>("/subjects/", {
          method: "POST",
          body: JSON.stringify({
            name,
            code,
            description: form.description.trim() || null,
          }),
        });
        setSuccess("Subject added successfully.");
      }

      setShowForm(false);
      resetSubjectForm();
      await fetchSubjects();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : editingSubject
            ? "Failed to update subject."
            : "Failed to add subject."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deactivateSubject = async (subject: Subject) => {
    if (
      !window.confirm(
        `Deactivate "${subject.name}"? It will no longer appear in the active catalog.`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await request<Subject>(`/subjects/${subject.id}`, { method: "DELETE" });
      setSuccess(`"${subject.name}" was deactivated.`);
      await fetchSubjects();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to deactivate subject."
      );
    }
  };

  const openAssignments = async (subject: Subject) => {
    setAssignmentSubject(subject);
    setSelectedClassId("");
    setAssignedSubjects([]);
    setShowAssignments(true);
    setError("");
    if (classes.length === 0) await fetchClasses();
  };

  const loadAssignedSubjects = async (classId: string) => {
    if (!assignmentSubject || !classId) {
      setAssignedSubjects([]);
      return;
    }

    setAssignmentLoading(true);
    setError("");
    try {
      const data = await request<ClassSubject[]>(
        `/classes/${classId}/subjects`
      );
      setAssignedSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load class subjects."
      );
    } finally {
      setAssignmentLoading(false);
    }
  };

  const assignSubject = async () => {
    if (!assignmentSubject || !selectedClassId) {
      setError("Select a class first.");
      return;
    }

    setAssignmentLoading(true);
    setError("");
    setSuccess("");

    try {
      await request(`/classes/${selectedClassId}/subjects/${assignmentSubject.id}`, {
        method: "POST",
      });
      setSuccess(
        `"${assignmentSubject.name}" assigned to the selected class.`
      );
      await loadAssignedSubjects(selectedClassId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to assign subject."
      );
    } finally {
      setAssignmentLoading(false);
    }
  };

  const removeAssignment = async (subject: ClassSubject) => {
    if (!selectedClassId) return;
    if (
      !window.confirm(
        `Remove "${subject.name}" from this class?`
      )
    ) {
      return;
    }

    setAssignmentLoading(true);
    setError("");
    setSuccess("");

    try {
      await request(
        `/classes/${selectedClassId}/subjects/${subject.id}`,
        { method: "DELETE" }
      );
      setSuccess(`"${subject.name}" removed from the class.`);
      await loadAssignedSubjects(selectedClassId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to remove assignment."
      );
    } finally {
      setAssignmentLoading(false);
    }
  };

  const openComponents = async (subject: Subject) => {
    setComponentSubject(subject);
    setComponents([]);
    setEditingComponent(null);
    setComponentForm({
      name: "",
      component_type: "GRADE",
      max_marks: "",
      include_in_result: false,
      display_order: "0",
      class_id: "",
    });
    setComponentClassId("");
    setShowComponents(true);
    setError("");
    if (classes.length === 0) await fetchClasses();
  };

  const loadComponents = async (classId: string) => {
    if (!componentSubject || !classId) {
      setComponents([]);
      return;
    }

    setComponentLoading(true);
    setError("");
    try {
      const data = await request<CoScholasticComponent[]>(
        `/subjects/${componentSubject.id}/co-scholastic/components?class_id=${classId}`
      );
      setComponents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to load components."
      );
    } finally {
      setComponentLoading(false);
    }
  };

  const resetComponentForm = () => {
    setEditingComponent(null);
    setComponentForm({
      name: "",
      component_type: "GRADE",
      max_marks: "",
      include_in_result: false,
      display_order: "0",
      class_id: componentClassId,
    });
  };

  const editComponent = (component: CoScholasticComponent) => {
    setEditingComponent(component);
    setComponentForm({
      name: component.name,
      component_type: component.component_type,
      max_marks:
        component.max_marks === null ? "" : String(component.max_marks),
      include_in_result: component.include_in_result,
      display_order: String(component.display_order),
      class_id: String(component.class_id),
    });
  };

  const submitComponent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!componentSubject || !componentClassId) {
      setError("Select a class first.");
      return;
    }

    if (!componentForm.name.trim()) {
      setError("Component name is required.");
      return;
    }

    const maxMarks =
      componentForm.max_marks.trim() === ""
        ? null
        : Number(componentForm.max_marks);

    const displayOrder = Number(componentForm.display_order);

    if (maxMarks !== null && (!Number.isFinite(maxMarks) || maxMarks < 0)) {
      setError("Maximum marks must be a valid non-negative number.");
      return;
    }

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      setError("Display order must be a non-negative whole number.");
      return;
    }

    setComponentSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editingComponent) {
        await request<CoScholasticComponent>(
          `/subjects/${componentSubject.id}/co-scholastic/components/${editingComponent.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              name: componentForm.name.trim(),
              component_type: componentForm.component_type,
              max_marks: maxMarks,
              include_in_result: componentForm.include_in_result,
              display_order: displayOrder,
            }),
          }
        );
        setSuccess("Co-scholastic component updated.");
      } else {
        await request<CoScholasticComponent>(
          `/subjects/${componentSubject.id}/co-scholastic/components`,
          {
            method: "POST",
            body: JSON.stringify({
              name: componentForm.name.trim(),
              component_type: componentForm.component_type,
              max_marks: maxMarks,
              include_in_result: componentForm.include_in_result,
              display_order: displayOrder,
              class_id: Number(componentClassId),
            }),
          }
        );
        setSuccess("Co-scholastic component created.");
      }

      resetComponentForm();
      await loadComponents(componentClassId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save co-scholastic component."
      );
    } finally {
      setComponentSubmitting(false);
    }
  };

  const deactivateComponent = async (component: CoScholasticComponent) => {
    if (!componentSubject) return;
    if (!window.confirm(`Deactivate "${component.name}"?`)) return;

    setComponentLoading(true);
    setError("");
    setSuccess("");

    try {
      await request(
        `/subjects/${componentSubject.id}/co-scholastic/components/${component.id}`,
        { method: "DELETE" }
      );
      setSuccess(`"${component.name}" was deactivated.`);
      await loadComponents(componentClassId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to deactivate component."
      );
    } finally {
      setComponentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
              EduOS · Academic Management
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
              Subjects
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage subjects, class assignments and co-scholastic configuration
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73]"
          >
            <span className="text-lg leading-none">+</span>
            Add Subject
          </button>
        </div>
      </header>

      <main className="px-6 py-7 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => router.push("/dashboard")}
              className="transition hover:text-[#315b9b]"
            >
              Dashboard
            </button>
            <span>›</span>
            <span className="font-medium text-slate-600">Subjects</span>
          </div>

          {success && (
            <Alert
              tone="success"
              message={success}
              onClose={() => setSuccess("")}
            />
          )}
          {error && (
            <Alert
              tone="error"
              message={error}
              onClose={() => setError("")}
            />
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <OverviewCard
              title="Total Subjects"
              value={subjects.length}
              description="Active catalog returned by API"
              icon="◆"
            />
            <OverviewCard
              title="Active Subjects"
              value={activeSubjects}
              description="Currently active"
              icon="✓"
              green
            />
            <OverviewCard
              title="Inactive Subjects"
              value={inactiveSubjects}
              description="Inactive records known locally"
              icon="—"
              red
            />
          </section>

          <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 lg:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                    Academic Catalog
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                    Subject Directory
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create, edit, deactivate and configure academic subjects.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      ⌕
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search subjects..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-64"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="all">All Status</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <LoadingTable />
              ) : filteredSubjects.length === 0 ? (
                <EmptyState search={search} onAdd={openCreate} />
              ) : (
                <table className="min-w-[1250px] w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      {[
                        "Subject",
                        "Code",
                        "Description",
                        "Status",
                        "Created",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubjects.map((subject) => {
                      const initials =
                        subject.name
                          .split(" ")
                          .map((word) => word[0] ?? "")
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "SU";

                      return (
                        <tr
                          key={subject.id}
                          className="group border-b border-slate-100 transition hover:bg-blue-50/30"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102a56] text-xs font-bold text-white">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {subject.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  Subject ID #{subject.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold tracking-wide text-blue-700">
                              {subject.code}
                            </span>
                          </td>
                          <td className="max-w-[320px] px-6 py-4">
                            <p className="truncate text-sm text-slate-600">
                              {subject.description || "No description provided"}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge active={subject.is_active} />
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-600">
                              {subject.created_at
                                ? new Date(subject.created_at).toLocaleDateString(
                                    "en-IN",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    }
                                  )
                                : "—"}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <ActionButton
                                label="Edit"
                                onClick={() => openEdit(subject)}
                              />
                              <ActionButton
                                label="Classes"
                                onClick={() => void openAssignments(subject)}
                              />
                              <ActionButton
                                label="Co-Scholastic"
                                onClick={() => void openComponents(subject)}
                              />
                              {subject.is_active && (
                                <ActionButton
                                  label="Deactivate"
                                  danger
                                  onClick={() => void deactivateSubject(subject)}
                                />
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

            {!loading && filteredSubjects.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  <strong className="text-slate-600">
                    {filteredSubjects.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-600">{subjects.length}</strong>{" "}
                  subjects
                </span>
                <span>EduOS Academic Catalog</span>
              </div>
            )}
          </section>
        </div>
      </main>

      {showForm && (
        <Modal
          title={editingSubject ? "Edit Subject" : "Add New Subject"}
          subtitle={
            editingSubject
              ? "Update the subject details."
              : "Create a subject for the academic catalog."
          }
          onClose={() => {
            setShowForm(false);
            resetSubjectForm();
          }}
        >
          <form onSubmit={handleSubjectSubmit} className="space-y-5">
            <Field
              label="Subject Name"
              required
              value={form.name}
              placeholder="e.g. Mathematics"
              onChange={(value) => setForm((p) => ({ ...p, name: value }))}
            />
            <Field
              label="Subject Code"
              required
              value={form.code}
              placeholder="e.g. MATH"
              onChange={(value) =>
                setForm((p) => ({ ...p, code: value.toUpperCase() }))
              }
            />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Description
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((p) => ({ ...p, description: event.target.value }))
                }
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetSubjectForm();
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting
                  ? editingSubject
                    ? "Saving..."
                    : "Creating..."
                  : editingSubject
                    ? "Save Changes"
                    : "Create Subject"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAssignments && assignmentSubject && (
        <Modal
          title={`Class Assignment · ${assignmentSubject.name}`}
          subtitle="Assign this subject to active classes or remove an existing assignment."
          wide
          onClose={() => {
            setShowAssignments(false);
            setAssignmentSubject(null);
          }}
        >
          <div className="space-y-5">
            <SelectField
              label="Class"
              value={selectedClassId}
              disabled={classesLoading}
              onChange={(value) => {
                setSelectedClassId(value);
                void loadAssignedSubjects(value);
              }}
              options={classes.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
              placeholder={classesLoading ? "Loading classes..." : "Select class"}
            />

            {selectedClassId && (
              <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-[#102a56]">
                    Assign subject
                  </p>
                  <p className="text-xs text-slate-500">
                    Add {assignmentSubject.code} to the selected class.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void assignSubject()}
                  disabled={assignmentLoading}
                  className="rounded-xl bg-[#102a56] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Assign
                </button>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#102a56]">
                  Assigned Subjects
                </h3>
                {assignmentLoading && (
                  <span className="text-xs text-slate-400">Loading...</span>
                )}
              </div>

              {!selectedClassId ? (
                <EmptyMini text="Select a class to view its subjects." />
              ) : assignedSubjects.length === 0 ? (
                <EmptyMini text="No subjects are assigned to this class." />
              ) : (
                <div className="space-y-2">
                  {assignedSubjects.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-400">{item.code}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeAssignment(item)}
                        disabled={assignmentLoading}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showComponents && componentSubject && (
        <Modal
          title={`Co-Scholastic · ${componentSubject.name}`}
          subtitle="Configure class-based co-scholastic components from the Subjects module."
          wide
          onClose={() => {
            setShowComponents(false);
            setComponentSubject(null);
            setEditingComponent(null);
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={submitComponent} className="space-y-4">
              <SelectField
                label="Class"
                value={componentClassId}
                disabled={classesLoading}
                onChange={(value) => {
                  setComponentClassId(value);
                  setComponentForm((p) => ({ ...p, class_id: value }));
                  void loadComponents(value);
                }}
                options={classes.map((item) => ({
                  value: String(item.id),
                  label: item.name,
                }))}
                placeholder={classesLoading ? "Loading classes..." : "Select class"}
              />

              <Field
                label="Component Name"
                required
                value={componentForm.name}
                placeholder="e.g. Art & Craft"
                onChange={(value) =>
                  setComponentForm((p) => ({ ...p, name: value }))
                }
              />

              <SelectField
                label="Component Type"
                value={componentForm.component_type}
                onChange={(value) =>
                  setComponentForm((p) => ({
                    ...p,
                    component_type: value as ComponentType,
                  }))
                }
                options={[
                  { value: "MARKS", label: "Marks" },
                  { value: "GRADE", label: "Grade" },
                  { value: "REMARK", label: "Remark" },
                ]}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Max Marks"
                  value={componentForm.max_marks}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  onChange={(value) =>
                    setComponentForm((p) => ({ ...p, max_marks: value }))
                  }
                />
                <Field
                  label="Display Order"
                  value={componentForm.display_order}
                  type="number"
                  min="0"
                  step="1"
                  onChange={(value) =>
                    setComponentForm((p) => ({
                      ...p,
                      display_order: value,
                    }))
                  }
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={componentForm.include_in_result}
                  onChange={(event) =>
                    setComponentForm((p) => ({
                      ...p,
                      include_in_result: event.target.checked,
                    }))
                  }
                />
                <span className="font-medium text-slate-700">
                  Include in result
                </span>
              </label>

              <div className="flex gap-2 border-t border-slate-100 pt-4">
                {editingComponent && (
                  <button
                    type="button"
                    onClick={resetComponentForm}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={componentSubmitting || !componentClassId}
                  className="rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {componentSubmitting
                    ? "Saving..."
                    : editingComponent
                      ? "Update Component"
                      : "Add Component"}
                </button>
              </div>
            </form>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#102a56]">
                  Components
                </h3>
                {componentLoading && (
                  <span className="text-xs text-slate-400">Loading...</span>
                )}
              </div>

              {!componentClassId ? (
                <EmptyMini text="Select a class to load its components." />
              ) : components.length === 0 ? (
                <EmptyMini text="No active co-scholastic components found." />
              ) : (
                <div className="space-y-2">
                  {components.map((component) => (
                    <div
                      key={component.id}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {component.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {component.component_type}
                            {component.max_marks !== null
                              ? ` · Max ${component.max_marks}`
                              : ""}
                            {component.include_in_result
                              ? " · Included in result"
                              : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editComponent(component)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deactivateComponent(component)}
                            className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Alert({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const success = tone === "success";
  return (
    <div
      className={`mb-5 flex items-center justify-between rounded-2xl border px-5 py-3 text-sm font-medium ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-lg opacity-60">
        ×
      </button>
    </div>
  );
}

function OverviewCard({
  title,
  value,
  description,
  icon,
  green = false,
  red = false,
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
  green?: boolean;
  red?: boolean;
}) {
  const iconClass = green
    ? "bg-emerald-50 text-emerald-700"
    : red
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-50" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[#102a56]">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        type={type}
        min={min}
        step={step}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ${
          wide ? "max-w-5xl" : "max-w-xl"
        }`}
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
              Academic Management
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#102a56]">{title}</h2>
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-2 w-28 rounded bg-slate-100" />
          </div>
          <div className="hidden h-8 w-20 rounded bg-slate-100 md:block" />
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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#102a56]">
        ◆
      </div>
      <h3 className="mt-5 text-lg font-bold text-[#102a56]">
        {search ? "No subjects found" : "No subjects yet"}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {search
          ? "Try changing your search or status filter."
          : "Start building your academic catalog by adding the first subject."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="mt-5 rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white"
        >
          + Add Subject
        </button>
      )}
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
