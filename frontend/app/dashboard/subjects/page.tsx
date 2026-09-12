"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

type Subject = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
};

type ClassSubject = {
  id: number;
  name: string;
  code: string;
  description: string | null;
};

type CoScholasticComponent = {
  id: number;
  class_id: number;
  name: string;
  component_type: "MARKS" | "GRADE" | "REMARK";
  max_marks: number | null;
  include_in_result: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SubjectForm = {
  name: string;
  code: string;
  description: string;
};

type CoForm = {
  class_id: string;
  name: string;
  component_type: "MARKS" | "GRADE" | "REMARK";
  max_marks: string;
  display_order: string;
  include_in_result: boolean;
};

type ApiError = {
  detail?: string;
  message?: string;
};

function getErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === "object" && value !== null) {
    const error = value as ApiError;
    if (typeof error.detail === "string") return error.detail;
    if (typeof error.message === "string") return error.message;
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { detail: text };
  }
}

export default function SubjectsPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"main" | "co">("main");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<ClassSubject[]>(
    [],
  );
  const [coComponents, setCoComponents] = useState<CoScholasticComponent[]>(
    [],
  );

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [coSearch, setCoSearch] = useState("");

  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingCo, setLoadingCo] = useState(false);

  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showCoModal, setShowCoModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showCoDeactivateModal, setShowCoDeactivateModal] = useState(false);

  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingCo, setEditingCo] = useState<CoScholasticComponent | null>(
    null,
  );
  const [deactivatingSubject, setDeactivatingSubject] =
    useState<Subject | null>(null);
  const [deactivatingCo, setDeactivatingCo] =
    useState<CoScholasticComponent | null>(null);

  const [subjectForm, setSubjectForm] = useState<SubjectForm>({
    name: "",
    code: "",
    description: "",
  });

  const [coForm, setCoForm] = useState<CoForm>({
    class_id: "",
    name: "",
    component_type: "GRADE",
    max_marks: "",
    display_order: "0",
    include_in_result: true,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  }, [router]);

  const request = useCallback(
    async (
      path: string,
      options: RequestInit = {},
    ): Promise<unknown> => {
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        logout();
        throw new Error("Your session has expired. Please login again.");
      }

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, `Request failed with status ${response.status}.`),
        );
      }

      return data;
    },
    [logout],
  );

  const fetchSubjects = useCallback(async () => {
    setLoadingSubjects(true);
    try {
      const data = await request("/subjects/");
      setSubjects(Array.isArray(data) ? (data as Subject[]) : []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load main subjects."));
    } finally {
      setLoadingSubjects(false);
    }
  }, [request]);

  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const data = await request("/classes/");
      const rows = Array.isArray(data) ? (data as SchoolClass[]) : [];
      setClasses(rows);
      if (!selectedClassId && rows.length > 0) {
        setSelectedClassId(String(rows[0].id));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load classes."));
    } finally {
      setLoadingClasses(false);
    }
  }, [request, selectedClassId]);

  const fetchAssignments = useCallback(
    async (classId: string) => {
      if (!classId) {
        setAssignedSubjects([]);
        return;
      }

      setLoadingAssignments(true);
      try {
        const data = await request(`/classes/${classId}/subjects`);
        setAssignedSubjects(
          Array.isArray(data) ? (data as ClassSubject[]) : [],
        );
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load class subjects."));
      } finally {
        setLoadingAssignments(false);
      }
    },
    [request],
  );

  const fetchCoComponents = useCallback(
    async (classId: string) => {
      if (!classId) {
        setCoComponents([]);
        return;
      }

      setLoadingCo(true);
      try {
        const data = await request(
          `/co-scholastic/components?class_id=${encodeURIComponent(classId)}`,
        );
        setCoComponents(
          Array.isArray(data) ? (data as CoScholasticComponent[]) : [],
        );
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load co-scholastic items."));
      } finally {
        setLoadingCo(false);
      }
    },
    [request],
  );

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // These calls intentionally start the initial data load for the page.
    // The callbacks perform the asynchronous state updates after the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSubjects();
    void fetchClasses();
  }, [fetchClasses, fetchSubjects, router]);

  useEffect(() => {
    if (!selectedClassId) return;
    // Class selection synchronizes the two class-scoped data sets.
    void fetchAssignments(selectedClassId);
    void fetchCoComponents(selectedClassId);
  }, [fetchAssignments, fetchCoComponents, selectedClassId]);

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return subjects;

    return subjects.filter(
      (subject) =>
        subject.name.toLowerCase().includes(query) ||
        subject.code.toLowerCase().includes(query) ||
        String(subject.id).includes(query),
    );
  }, [search, subjects]);

  const filteredCo = useMemo(() => {
    const query = coSearch.trim().toLowerCase();
    if (!query) return coComponents;

    return coComponents.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.component_type.toLowerCase().includes(query),
    );
  }, [coComponents, coSearch]);

  const assignedIds = useMemo(
    () => new Set(assignedSubjects.map((subject) => subject.id)),
    [assignedSubjects],
  );

  const availableForAssignment = useMemo(
    () => subjects.filter((subject) => !assignedIds.has(subject.id)),
    [assignedIds, subjects],
  );

  const resetSubjectForm = () =>
    setSubjectForm({ name: "", code: "", description: "" });

  const resetCoForm = (classId = selectedClassId) =>
    setCoForm({
      class_id: classId,
      name: "",
      component_type: "GRADE",
      max_marks: "",
      display_order: "0",
      include_in_result: true,
    });

  const saveSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      setError("Subject name and code are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        description: subjectForm.description.trim() || null,
      };

      if (editingSubject) {
        await request(`/subjects/${editingSubject.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Main subject updated successfully.");
      } else {
        await request("/subjects/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Main subject created successfully.");
      }

      setShowSubjectModal(false);
      setEditingSubject(null);
      resetSubjectForm();
      await fetchSubjects();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save main subject."));
    } finally {
      setSaving(false);
    }
  };

  const deactivateSubject = async () => {
    if (!deactivatingSubject) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      await request(`/subjects/${deactivatingSubject.id}`, {
        method: "DELETE",
      });
      setSuccess(`${deactivatingSubject.name} was deactivated.`);
      setShowDeactivateModal(false);
      setDeactivatingSubject(null);
      await fetchSubjects();
      if (selectedClassId) await fetchAssignments(selectedClassId);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to deactivate main subject."));
    } finally {
      setDeleting(false);
    }
  };

  const assignSubject = async (subjectId: number) => {
    if (!selectedClassId) {
      setError("Select a class first.");
      return;
    }

    try {
      await request(
        `/classes/${selectedClassId}/subjects/${subjectId}`,
        { method: "POST" },
      );
      setSuccess("Main subject assigned to the class.");
      await fetchAssignments(selectedClassId);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to assign subject."));
    }
  };

  const removeAssignment = async (subjectId: number) => {
    if (!selectedClassId) return;

    try {
      await request(
        `/classes/${selectedClassId}/subjects/${subjectId}`,
        { method: "DELETE" },
      );
      setSuccess("Main subject removed from the class.");
      await fetchAssignments(selectedClassId);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to remove subject."));
    }
  };

  const saveCo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!coForm.class_id || !coForm.name.trim()) {
      setError("Class and co-scholastic name are required.");
      return;
    }

    if (
      coForm.component_type === "MARKS" &&
      (!coForm.max_marks || Number(coForm.max_marks) < 0)
    ) {
      setError("Maximum marks are required for a MARKS evaluation.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload: Record<string, unknown> = {
        class_id: Number(coForm.class_id),
        name: coForm.name.trim(),
        component_type: coForm.component_type,
        max_marks:
          coForm.component_type === "MARKS"
            ? Number(coForm.max_marks)
            : null,
        display_order: Number(coForm.display_order || "0"),
        include_in_result: coForm.include_in_result,
      };

      if (editingCo) {
        delete payload.class_id;
        await request(`/co-scholastic/components/${editingCo.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Co-Scholastic evaluation updated successfully.");
      } else {
        await request("/co-scholastic/components", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Co-Scholastic evaluation created successfully.");
      }

      setShowCoModal(false);
      setEditingCo(null);
      resetCoForm(coForm.class_id);
      await fetchCoComponents(coForm.class_id);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save co-scholastic item."));
    } finally {
      setSaving(false);
    }
  };

  const deactivateCo = async () => {
    if (!deactivatingCo) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      await request(`/co-scholastic/components/${deactivatingCo.id}`, {
        method: "DELETE",
      });
      setSuccess(`${deactivatingCo.name} was deactivated.`);
      setShowCoDeactivateModal(false);
      setDeactivatingCo(null);
      await fetchCoComponents(selectedClassId);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to deactivate co-scholastic item."));
    } finally {
      setDeleting(false);
    }
  };

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name,
      code: subject.code,
      description: subject.description ?? "",
    });
    setError("");
    setShowSubjectModal(true);
  };

  const openEditCo = (item: CoScholasticComponent) => {
    setEditingCo(item);
    setCoForm({
      class_id: String(item.class_id),
      name: item.name,
      component_type: item.component_type,
      max_marks:
        item.max_marks === null ? "" : String(item.max_marks),
      display_order: String(item.display_order),
      include_in_result: item.include_in_result,
    });
    setError("");
    setShowCoModal(true);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
              EduOS · Academic Management
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
              Subjects
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Main Subjects and Co-Scholastic are managed separately.
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              if (tab === "main") {
                setEditingSubject(null);
                resetSubjectForm();
                setShowSubjectModal(true);
              } else {
                setEditingCo(null);
                resetCoForm();
                setShowCoModal(true);
              }
            }}
            className="rounded-xl bg-[#102a56] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73]"
          >
            + Add {tab === "main" ? "Main Subject" : "Co-Scholastic"}
          </button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-5 text-xs text-slate-400">
            <button
              onClick={() => router.push("/dashboard")}
              className="hover:text-[#315b9b]"
            >
              Dashboard
            </button>{" "}
            › Subjects
          </div>

          {success && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{error}</span>
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Main Subjects"
              value={subjects.length}
              description="Counted in academic exams"
            />
            <StatCard
              title="Co-Scholastic"
              value={coComponents.length}
              description="Separate evaluation"
            />
            <StatCard
              title="Selected Class"
              value={
                classes.find((item) => String(item.id) === selectedClassId)
                  ?.name || "Not selected"
              }
              description="Class configuration"
            />
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTab("main")}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                  tab === "main"
                    ? "bg-[#102a56] text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                Main Subjects
                <span className="ml-2 text-xs opacity-75">
                  Exam Marks
                </span>
              </button>
              <button
                onClick={() => setTab("co")}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                  tab === "co"
                    ? "bg-[#102a56] text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                Co-Scholastic
                <span className="ml-2 text-xs opacity-75">
                  Separate Evaluation
                </span>
              </button>
            </div>
          </div>

          {tab === "main" ? (
            <MainSubjectsSection
              subjects={filteredSubjects}
              allSubjects={subjects}
              classes={classes}
              selectedClassId={selectedClassId}
              setSelectedClassId={setSelectedClassId}
              search={search}
              setSearch={setSearch}
              assignedSubjects={assignedSubjects}
              availableForAssignment={availableForAssignment}
              loadingSubjects={loadingSubjects}
              loadingClasses={loadingClasses}
              loadingAssignments={loadingAssignments}
              onEdit={openEditSubject}
              onDeactivate={(subject) => {
                setDeactivatingSubject(subject);
                setShowDeactivateModal(true);
              }}
              onAssign={assignSubject}
              onRemove={removeAssignment}
            />
          ) : (
            <CoScholasticSection
              components={filteredCo}
              classes={classes}
              selectedClassId={selectedClassId}
              setSelectedClassId={setSelectedClassId}
              search={coSearch}
              setSearch={setCoSearch}
              loading={loadingCo || loadingClasses}
              onEdit={openEditCo}
              onDeactivate={(item) => {
                setDeactivatingCo(item);
                setShowCoDeactivateModal(true);
              }}
            />
          )}
        </div>
      </main>

      {showSubjectModal && (
        <Modal
          title={editingSubject ? "Edit Main Subject" : "Add Main Subject"}
          onClose={() => {
            if (saving) return;
            setShowSubjectModal(false);
            setEditingSubject(null);
            resetSubjectForm();
          }}
        >
          <form onSubmit={saveSubject} className="space-y-5">
            <Field label="Subject Name" required>
              <input
                value={subjectForm.name}
                onChange={(event) =>
                  setSubjectForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Mathematics"
                className={inputClass}
              />
            </Field>

            <Field label="Subject Code" required>
              <input
                value={subjectForm.code}
                onChange={(event) =>
                  setSubjectForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="MATH"
                className={inputClass}
              />
            </Field>

            <Field label="Description">
              <textarea
                value={subjectForm.description}
                onChange={(event) =>
                  setSubjectForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                className={`${inputClass} h-auto py-3`}
              />
            </Field>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              Main Subjects are the subjects whose exam marks can contribute
              to academic totals, percentage and grade calculations.
            </div>

            <ModalActions
              saving={saving}
              submitText={editingSubject ? "Save Changes" : "Create Subject"}
              onClose={() => setShowSubjectModal(false)}
            />
          </form>
        </Modal>
      )}

      {showCoModal && (
        <Modal
          title={editingCo ? "Edit Co-Scholastic" : "Add Co-Scholastic"}
          onClose={() => {
            if (saving) return;
            setShowCoModal(false);
            setEditingCo(null);
            resetCoForm();
          }}
        >
          <form onSubmit={saveCo} className="space-y-5">
            <Field label="Class" required>
              <select
                value={coForm.class_id}
                disabled={Boolean(editingCo)}
                onChange={(event) =>
                  setCoForm((current) => ({
                    ...current,
                    class_id: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Evaluation Name" required>
              <input
                value={coForm.name}
                onChange={(event) =>
                  setCoForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Art & Craft"
                className={inputClass}
              />
            </Field>

            <Field label="Evaluation Type" required>
              <select
                value={coForm.component_type}
                onChange={(event) =>
                  setCoForm((current) => ({
                    ...current,
                    component_type: event.target.value as CoForm["component_type"],
                    max_marks:
                      event.target.value === "MARKS"
                        ? current.max_marks
                        : "",
                  }))
                }
                className={inputClass}
              >
                <option value="GRADE">Grade</option>
                <option value="MARKS">Marks</option>
                <option value="REMARK">Remark</option>
              </select>
            </Field>

            {coForm.component_type === "MARKS" && (
              <Field label="Maximum Marks" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={coForm.max_marks}
                  onChange={(event) =>
                    setCoForm((current) => ({
                      ...current,
                      max_marks: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
            )}

            <Field label="Display Order">
              <input
                type="number"
                min="0"
                value={coForm.display_order}
                onChange={(event) =>
                  setCoForm((current) => ({
                    ...current,
                    display_order: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={coForm.include_in_result}
                onChange={(event) =>
                  setCoForm((current) => ({
                    ...current,
                    include_in_result: event.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-700">
                  Show in report result
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  This controls display only. It does not add Co-Scholastic
                  values to academic exam totals or percentage.
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
              Co-Scholastic is a separate evaluation category. Its marks,
              grades and remarks are not part of Main Subject exam totals.
            </div>

            <ModalActions
              saving={saving}
              submitText={editingCo ? "Save Changes" : "Create Evaluation"}
              onClose={() => setShowCoModal(false)}
            />
          </form>
        </Modal>
      )}

      {showDeactivateModal && deactivatingSubject && (
        <ConfirmModal
          title="Deactivate Main Subject"
          message={`Deactivate "${deactivatingSubject.name}"? Existing exam data will not be deleted.`}
          loading={deleting}
          onClose={() => setShowDeactivateModal(false)}
          onConfirm={deactivateSubject}
        />
      )}

      {showCoDeactivateModal && deactivatingCo && (
        <ConfirmModal
          title="Deactivate Co-Scholastic"
          message={`Deactivate "${deactivatingCo.name}" for this class? Existing evaluations will not be deleted.`}
          loading={deleting}
          onClose={() => setShowCoDeactivateModal(false)}
          onConfirm={deactivateCo}
        />
      )}
    </div>
  );
}

function MainSubjectsSection({
  subjects,
  allSubjects,
  classes,
  selectedClassId,
  setSelectedClassId,
  search,
  setSearch,
  assignedSubjects,
  availableForAssignment,
  loadingSubjects,
  loadingClasses,
  loadingAssignments,
  onEdit,
  onDeactivate,
  onAssign,
  onRemove,
}: {
  subjects: Subject[];
  allSubjects: Subject[];
  classes: SchoolClass[];
  selectedClassId: string;
  setSelectedClassId: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  assignedSubjects: ClassSubject[];
  availableForAssignment: Subject[];
  loadingSubjects: boolean;
  loadingClasses: boolean;
  loadingAssignments: boolean;
  onEdit: (subject: Subject) => void;
  onDeactivate: (subject: Subject) => void;
  onAssign: (subjectId: number) => void;
  onRemove: (subjectId: number) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          eyebrow="Main Subjects"
          title="Academic Subject Directory"
          description="Only Main Subjects belong to the academic exam-mark structure."
          search={search}
          setSearch={setSearch}
          select={
            <select
              value={selectedClassId}
              disabled={loadingClasses}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className={selectClass}
            >
              <option value="">Select class</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          }
        />

        {loadingSubjects ? (
          <Loading />
        ) : subjects.length === 0 ? (
          <Empty message="No main subjects found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <Th>Subject</Th>
                  <Th>Code</Th>
                  <Th>Description</Th>
                  <Th>Exam Role</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr
                    key={subject.id}
                    className="border-b border-slate-100 hover:bg-blue-50/30"
                  >
                    <Td>
                      <strong>{subject.name}</strong>
                      <span className="mt-1 block text-xs text-slate-400">
                        ID #{subject.id}
                      </span>
                    </Td>
                    <Td>
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">
                        {subject.code}
                      </span>
                    </Td>
                    <Td>{subject.description || "—"}</Td>
                    <Td>
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        Counts in academic exams
                      </span>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEdit(subject)}
                          className={actionBlue}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDeactivate(subject)}
                          className={actionRed}
                        >
                          Deactivate
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loadingSubjects && (
          <div className="border-t border-slate-100 px-6 py-4 text-xs text-slate-400">
            Showing {subjects.length} of {allSubjects.length} active Main
            Subjects.
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#315b9b]">
              Class Configuration
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#102a56]">
              Assigned Main Subjects
            </h3>
          </div>

          {loadingAssignments ? (
            <Loading />
          ) : assignedSubjects.length === 0 ? (
            <Empty message="No Main Subjects assigned to this class." />
          ) : (
            <div className="divide-y divide-slate-100">
              {assignedSubjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between gap-4 px-6 py-4"
                >
                  <div>
                    <p className="font-semibold text-slate-700">
                      {subject.name}
                    </p>
                    <p className="text-xs text-slate-400">{subject.code}</p>
                  </div>
                  <button
                    onClick={() => onRemove(subject.id)}
                    className={actionRed}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#315b9b]">
              Class Configuration
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#102a56]">
              Add Main Subjects to Class
            </h3>
          </div>

          {availableForAssignment.length === 0 ? (
            <Empty message="All active Main Subjects are already assigned." />
          ) : (
            <div className="divide-y divide-slate-100">
              {availableForAssignment.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between gap-4 px-6 py-4"
                >
                  <div>
                    <p className="font-semibold text-slate-700">
                      {subject.name}
                    </p>
                    <p className="text-xs text-slate-400">{subject.code}</p>
                  </div>
                  <button
                    onClick={() => onAssign(subject.id)}
                    disabled={!selectedClassId}
                    className={actionGreen}
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CoScholasticSection({
  components,
  classes,
  selectedClassId,
  setSelectedClassId,
  search,
  setSearch,
  loading,
  onEdit,
  onDeactivate,
}: {
  components: CoScholasticComponent[];
  classes: SchoolClass[];
  selectedClassId: string;
  setSelectedClassId: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  onEdit: (item: CoScholasticComponent) => void;
  onDeactivate: (item: CoScholasticComponent) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <SectionHeader
        eyebrow="Separate Evaluation"
        title="Co-Scholastic"
        description="Class-wise evaluations kept outside academic exam totals."
        search={search}
        setSearch={setSearch}
        select={
          <select
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
            className={selectClass}
          >
            <option value="">Select class</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="border-b border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-800">
        <strong>Separate from Main Subjects:</strong> Co-Scholastic marks,
        grades and remarks are displayed as evaluations and are not included
        in academic exam total marks, maximum marks or percentage.
      </div>

      {loading ? (
        <Loading />
      ) : components.length === 0 ? (
        <Empty message="No Co-Scholastic evaluations configured for this class." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <Th>Evaluation</Th>
                <Th>Type</Th>
                <Th>Maximum</Th>
                <Th>Display Order</Th>
                <Th>Result Display</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {components.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 hover:bg-amber-50/30"
                >
                  <Td>
                    <strong>{item.name}</strong>
                    <span className="mt-1 block text-xs text-slate-400">
                      Co-Scholastic #{item.id}
                    </span>
                  </Td>
                  <Td>
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700">
                      {item.component_type}
                    </span>
                  </Td>
                  <Td>{item.max_marks ?? "—"}</Td>
                  <Td>{item.display_order}</Td>
                  <Td>
                    {item.include_in_result ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        Display
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                        Hidden
                      </span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(item)} className={actionBlue}>
                        Edit
                      </button>
                      <button
                        onClick={() => onDeactivate(item)}
                        className={actionRed}
                      >
                        Deactivate
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  search,
  setSearch,
  select,
}: {
  eyebrow: string;
  title: string;
  description: string;
  search: string;
  setSearch: (value: string) => void;
  select: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 p-5 lg:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#102a56]">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {select}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-[#102a56]">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#315b9b]">
              EduOS
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#102a56]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  saving,
  submitText,
  onClose,
}: {
  saving: boolean;
  submitText: string;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
      <button
        type="button"
        disabled={saving}
        onClick={onClose}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : submitText}
      </button>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  loading,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-[#102a56]">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="px-6 py-12 text-center text-sm text-slate-400">
      Loading...
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="px-6 py-12 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-6 py-4 text-sm text-slate-600">{children}</td>;
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100";

const selectClass =
  "h-11 min-w-[180px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100";

const actionBlue =
  "rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100";

const actionRed =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100";

const actionGreen =
  "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100";
