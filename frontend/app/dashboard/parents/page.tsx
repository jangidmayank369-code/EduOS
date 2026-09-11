"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

type Parent = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Student = {
  id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_id: number | null;
  is_active?: boolean;
  status?: string;
};

type ParentChild = {
  parent_id: number;
  student_id: number;
  relation_type: string;
  is_primary: boolean;
  is_emergency_contact: boolean;
  receives_notifications: boolean;
  created_at?: string;
  updated_at?: string;
  student?: {
    id: number;
    admission_number: string;
    first_name: string;
    last_name: string;
    class_id: number | null;
  } | null;
};

type ParentForm = {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
};

type ChildForm = {
  student_id: string;
  relation_type: string;
  is_primary: boolean;
  is_emergency_contact: boolean;
  receives_notifications: boolean;
};

type Mode = "view" | "create" | "edit";

type ChildMode = "none" | "create" | "edit";

const RELATIONS = [
  "FATHER",
  "MOTHER",
  "GUARDIAN",
  "GRANDFATHER",
  "GRANDMOTHER",
  "OTHER",
];

function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("access_token");
}

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

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

function getInitials(parent: Parent) {
  return `${parent.first_name?.[0] || ""}${
    parent.last_name?.[0] || ""
  }`.toUpperCase();
}

function emptyParentForm(): ParentForm {
  return {
    user_id: "",
    first_name: "",
    last_name: "",
    phone: "",
  };
}

function emptyChildForm(): ChildForm {
  return {
    student_id: "",
    relation_type: "GUARDIAN",
    is_primary: false,
    is_emergency_contact: false,
    receives_notifications: true,
  };
}

export default function ParentsAdminPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [children, setChildren] = useState<ParentChild[]>([]);

  const [selectedParent, setSelectedParent] =
    useState<Parent | null>(null);

  const [selectedChild, setSelectedChild] =
    useState<ParentChild | null>(null);

  const [mode, setMode] = useState<Mode>("view");
  const [childMode, setChildMode] =
    useState<ChildMode>("none");

  const [form, setForm] =
    useState<ParentForm>(emptyParentForm());

  const [childForm, setChildForm] =
    useState<ChildForm>(emptyChildForm());

  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] =
    useState(false);
  const [loadingChildren, setLoadingChildren] =
    useState(false);
  const [loadingStudents, setLoadingStudents] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [savingChild, setSavingChild] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unlinkingStudentId, setUnlinkingStudentId] =
    useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const readError = async (
    response: Response,
    fallback: string,
  ) => {
    const body = await response.json().catch(() => null);

    if (typeof body?.detail === "string") {
      return body.detail;
    }

    if (Array.isArray(body?.detail)) {
      return body.detail
        .map(
          (item: { msg?: string }) =>
            item.msg || "Validation error",
        )
        .join(", ");
    }

    return fallback;
  };

  const apiFetch = async (
    path: string,
    options: RequestInit = {},
  ) => {
    const token = getToken();

    if (!token) {
      throw new Error(
        "Authentication token not found. Please login again.",
      );
    }

    const headers = new Headers(options.headers);

    headers.set("Authorization", `Bearer ${token}`);

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  };

  /* ============================================================
     PARENTS
     ============================================================ */

  const loadParents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/parents/");

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please login again.",
        );
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission to manage parents.",
        );
      }

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to load parents.",
          ),
        );
      }

      const data: Parent[] = await response.json();

      setParents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load parents.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadParent = async (parentId: number) => {
    try {
      setLoadingDetails(true);
      setError("");

      const response = await apiFetch(
        `/parents/${parentId}`,
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to load parent details.",
          ),
        );
      }

      const data: Parent = await response.json();

      setSelectedParent(data);

      setForm({
        user_id: String(data.user_id),
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone: data.phone || "",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load parent details.",
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  /* ============================================================
     STUDENTS
     ============================================================ */

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);

      const response = await apiFetch("/students/");

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to load students.",
          ),
        );
      }

      const data: Student[] = await response.json();

      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load students.",
      );
    } finally {
      setLoadingStudents(false);
    }
  };

  /* ============================================================
     CHILDREN
     ============================================================ */

  const loadChildren = async (parentId: number) => {
    try {
      setLoadingChildren(true);

      const response = await apiFetch(
        `/parent-children/parent/${parentId}`,
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to load linked children.",
          ),
        );
      }

      const data: ParentChild[] = await response.json();

      setChildren(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load linked children.",
      );
    } finally {
      setLoadingChildren(false);
    }
  };

  useEffect(() => {
    loadParents();
    loadStudents();
  }, []);

  /* ============================================================
     FILTERS
     ============================================================ */

  const filteredParents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return parents;
    }

    return parents.filter((parent) => {
      const fullName =
        `${parent.first_name} ${parent.last_name}`.toLowerCase();

      return (
        fullName.includes(query) ||
        String(parent.id).includes(query) ||
        String(parent.user_id).includes(query) ||
        (parent.phone || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [parents, search]);

  const linkedStudentIds = useMemo(() => {
    return new Set(
      children.map((child) => child.student_id),
    );
  }, [children]);

  const availableStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();

    return students.filter((student) => {
      if (
        childMode === "create" &&
        linkedStudentIds.has(student.id)
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const fullName =
        `${student.first_name} ${student.last_name}`.toLowerCase();

      return (
        fullName.includes(query) ||
        student.admission_number
          .toLowerCase()
          .includes(query) ||
        String(student.id).includes(query)
      );
    });
  }, [
    students,
    studentSearch,
    childMode,
    linkedStudentIds,
  ]);

  /* ============================================================
     PARENT UI ACTIONS
     ============================================================ */

  const openCreate = () => {
    setSelectedParent(null);
    setSelectedChild(null);

    setMode("create");
    setChildMode("none");

    setForm(emptyParentForm());
    setChildForm(emptyChildForm());

    setChildren([]);

    setError("");
    setSuccess("");
  };

  const openView = async (parent: Parent) => {
    setMode("view");
    setChildMode("none");

    setSelectedParent(parent);
    setSelectedChild(null);

    setError("");
    setSuccess("");

    await Promise.all([
      loadParent(parent.id),
      loadChildren(parent.id),
    ]);
  };

  const openEdit = async (parent: Parent) => {
    setMode("edit");
    setChildMode("none");

    setSelectedParent(parent);
    setSelectedChild(null);

    setError("");
    setSuccess("");

    await Promise.all([
      loadParent(parent.id),
      loadChildren(parent.id),
    ]);
  };

  const closePanel = () => {
    setMode("view");
    setChildMode("none");

    setSelectedParent(null);
    setSelectedChild(null);

    setForm(emptyParentForm());
    setChildForm(emptyChildForm());

    setChildren([]);

    setError("");
    setSuccess("");
  };

  const handleFormChange = (
    field: keyof ParentForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  /* ============================================================
     CREATE PARENT
     ============================================================ */

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const userId = Number(form.user_id);

      if (!userId || userId <= 0) {
        setError("Please enter a valid User ID.");
        return;
      }

      if (!form.first_name.trim()) {
        setError("First name is required.");
        return;
      }

      if (!form.last_name.trim()) {
        setError("Last name is required.");
        return;
      }

      const response = await apiFetch("/parents/", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to create parent.",
          ),
        );
      }

      const created: Parent = await response.json();

      setParents((current) => [created, ...current]);

      setSelectedParent(created);
      setMode("view");

      setForm({
        user_id: String(created.user_id),
        first_name: created.first_name,
        last_name: created.last_name,
        phone: created.phone || "",
      });

      setChildren([]);

      setSuccess("Parent created successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create parent.",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     UPDATE PARENT
     ============================================================ */

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedParent) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!form.first_name.trim()) {
        setError("First name is required.");
        return;
      }

      if (!form.last_name.trim()) {
        setError("Last name is required.");
        return;
      }

      const response = await apiFetch(
        `/parents/${selectedParent.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            phone: form.phone.trim() || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to update parent.",
          ),
        );
      }

      const updated: Parent = await response.json();

      setParents((current) =>
        current.map((parent) =>
          parent.id === updated.id ? updated : parent,
        ),
      );

      setSelectedParent(updated);
      setMode("view");

      setSuccess("Parent updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update parent.",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     DEACTIVATE PARENT
     ============================================================ */

  const handleDelete = async () => {
    if (!selectedParent) {
      return;
    }

    const confirmed = window.confirm(
      `Deactivate parent "${selectedParent.first_name} ${selectedParent.last_name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setSuccess("");

      const response = await apiFetch(
        `/parents/${selectedParent.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to deactivate parent.",
          ),
        );
      }

      setParents((current) =>
        current.filter(
          (parent) => parent.id !== selectedParent.id,
        ),
      );

      setSelectedParent(null);
      setSelectedChild(null);
      setChildren([]);

      setMode("view");
      setChildMode("none");

      setSuccess("Parent deactivated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to deactivate parent.",
      );
    } finally {
      setDeleting(false);
    }
  };

  /* ============================================================
     REACTIVATE PARENT
     ============================================================ */

  const handleReactivate = async () => {
    if (!selectedParent) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await apiFetch(
        `/parents/${selectedParent.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            is_active: true,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to reactivate parent.",
          ),
        );
      }

      const updated: Parent = await response.json();

      setSelectedParent(updated);

      setParents((current) =>
        current.some(
          (parent) => parent.id === updated.id,
        )
          ? current.map((parent) =>
              parent.id === updated.id ? updated : parent,
            )
          : [updated, ...current],
      );

      setSuccess("Parent reactivated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reactivate parent.",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     CHILD UI
     ============================================================ */

  const openLinkChild = async () => {
    if (!selectedParent) {
      return;
    }

    setChildMode("create");
    setSelectedChild(null);
    setChildForm(emptyChildForm());
    setStudentSearch("");
    setError("");
    setSuccess("");

    if (students.length === 0) {
      await loadStudents();
    }
  };

  const openEditChild = (relationship: ParentChild) => {
    setSelectedChild(relationship);

    setChildMode("edit");

    setChildForm({
      student_id: String(relationship.student_id),
      relation_type:
        relationship.relation_type || "GUARDIAN",
      is_primary: relationship.is_primary,
      is_emergency_contact:
        relationship.is_emergency_contact,
      receives_notifications:
        relationship.receives_notifications,
    });

    setStudentSearch("");
    setError("");
    setSuccess("");
  };

  const closeChildForm = () => {
    setChildMode("none");
    setSelectedChild(null);
    setChildForm(emptyChildForm());
    setStudentSearch("");
  };

  const handleChildFormChange = (
    field: keyof ChildForm,
    value: string | boolean,
  ) => {
    setChildForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  /* ============================================================
     LINK CHILD
     ============================================================ */

  const handleLinkChild = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    if (!selectedParent) {
      return;
    }

    const studentId = Number(childForm.student_id);

    if (!studentId || studentId <= 0) {
      setError("Please select a student.");
      return;
    }

    try {
      setSavingChild(true);
      setError("");
      setSuccess("");

      const response = await apiFetch(
        "/parent-children/",
        {
          method: "POST",
          body: JSON.stringify({
            parent_id: selectedParent.id,
            student_id: studentId,
            relation_type:
              childForm.relation_type.toUpperCase(),
            is_primary: childForm.is_primary,
            is_emergency_contact:
              childForm.is_emergency_contact,
            receives_notifications:
              childForm.receives_notifications,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to link student.",
          ),
        );
      }

      const created: ParentChild =
        await response.json();

      setChildren((current) => [
        ...current,
        created,
      ]);

      setChildMode("none");
      setSelectedChild(null);
      setChildForm(emptyChildForm());

      setSuccess(
        "Student linked to parent successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to link student.",
      );
    } finally {
      setSavingChild(false);
    }
  };

  /* ============================================================
     UPDATE CHILD RELATIONSHIP
     ============================================================ */

  const handleUpdateChild = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    if (!selectedParent || !selectedChild) {
      return;
    }

    try {
      setSavingChild(true);
      setError("");
      setSuccess("");

      const response = await apiFetch(
        `/parent-children/${selectedParent.id}/${selectedChild.student_id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            relation_type:
              childForm.relation_type.toUpperCase(),
            is_primary: childForm.is_primary,
            is_emergency_contact:
              childForm.is_emergency_contact,
            receives_notifications:
              childForm.receives_notifications,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to update relationship.",
          ),
        );
      }

      const updated: ParentChild =
        await response.json();

      setChildren((current) =>
        current.map((child) =>
          child.parent_id ===
            updated.parent_id &&
          child.student_id === updated.student_id
            ? updated
            : child,
        ),
      );

      setChildMode("none");
      setSelectedChild(null);

      setSuccess(
        "Parent-child relationship updated.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update relationship.",
      );
    } finally {
      setSavingChild(false);
    }
  };

  /* ============================================================
     UNLINK CHILD
     ============================================================ */

  const handleUnlinkChild = async (
    relationship: ParentChild,
  ) => {
    if (!selectedParent) {
      return;
    }

    const studentName = relationship.student
      ? `${relationship.student.first_name} ${relationship.student.last_name}`
      : `Student #${relationship.student_id}`;

    const confirmed = window.confirm(
      `Unlink "${studentName}" from this parent?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setUnlinkingStudentId(
        relationship.student_id,
      );

      setError("");
      setSuccess("");

      const response = await apiFetch(
        `/parent-children/${selectedParent.id}/${relationship.student_id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            "Unable to unlink student.",
          ),
        );
      }

      setChildren((current) =>
        current.filter(
          (child) =>
            child.student_id !==
            relationship.student_id,
        ),
      );

      setSuccess(
        "Student unlinked from parent successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to unlink student.",
      );
    } finally {
      setUnlinkingStudentId(null);
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
              Administration
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Parent Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              View, create, edit, deactivate parents and manage
              their linked students.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            + Add Parent
          </button>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="font-bold"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <span>{success}</span>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* STATS */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Active Parents
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-950">
              {parents.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Search Results
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {filteredParents.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Linked Children
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {children.length}
            </p>
          </div>
        </div>

        {/* PARENTS TABLE */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">
                Parents
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                All currently active parent profiles.
              </p>
            </div>

            <div className="w-full md:max-w-sm">
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search name, ID, user ID or phone..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

                <p className="mt-4 text-sm font-medium text-slate-500">
                  Loading parents...
                </p>
              </div>
            </div>
          ) : filteredParents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                👨‍👩‍👧
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-950">
                {search
                  ? "No parents found"
                  : "No parents yet"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {search
                  ? "Try a different search term."
                  : "Create the first parent profile using the Add Parent button."}
              </p>

              {!search && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                >
                  + Add Parent
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4">
                      Parent
                    </th>
                    <th className="px-5 py-4">
                      Parent ID
                    </th>
                    <th className="px-5 py-4">
                      User ID
                    </th>
                    <th className="px-5 py-4">
                      Phone
                    </th>
                    <th className="px-5 py-4">
                      Created
                    </th>
                    <th className="px-5 py-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredParents.map((parent) => (
                    <tr
                      key={parent.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                            {getInitials(parent)}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">
                              {parent.first_name}{" "}
                              {parent.last_name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              Active parent
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                        #{parent.id}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        #{parent.user_id}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {parent.phone || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(parent.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openView(parent)
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEdit(parent)
                            }
                            className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* MAIN SIDE PANEL */}
        {(mode === "create" ||
          mode === "edit" ||
          selectedParent) && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
            <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
              {/* PANEL HEADER */}
              <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                      {mode === "create"
                        ? "New Parent"
                        : mode === "edit"
                          ? "Edit Parent"
                          : "Parent Details"}
                    </p>

                    <h2 className="mt-1 text-2xl font-bold text-slate-950">
                      {mode === "create"
                        ? "Add Parent"
                        : selectedParent
                          ? `${selectedParent.first_name} ${selectedParent.last_name}`
                          : "Parent"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-lg font-bold text-slate-600 hover:bg-slate-200"
                  >
                    ×
                  </button>
                </div>
              </div>

              {loadingDetails ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

                    <p className="mt-4 text-sm text-slate-500">
                      Loading details...
                    </p>
                  </div>
                </div>
              ) : mode === "create" ? (
                /* =================================================
                   CREATE PARENT
                   ================================================= */
                <form
                  onSubmit={handleCreate}
                  className="space-y-5 p-6"
                >
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      Parent User ID
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      Enter an existing active user whose role is
                      <strong> parent</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      User ID *
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={form.user_id}
                      onChange={(event) =>
                        handleFormChange(
                          "user_id",
                          event.target.value,
                        )
                      }
                      placeholder="e.g. 8"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        First Name *
                      </label>

                      <input
                        type="text"
                        value={form.first_name}
                        onChange={(event) =>
                          handleFormChange(
                            "first_name",
                            event.target.value,
                          )
                        }
                        placeholder="First name"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Last Name *
                      </label>

                      <input
                        type="text"
                        value={form.last_name}
                        onChange={(event) =>
                          handleFormChange(
                            "last_name",
                            event.target.value,
                          )
                        }
                        placeholder="Last name"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Phone
                    </label>

                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        handleFormChange(
                          "phone",
                          event.target.value,
                        )
                      }
                      placeholder="Phone number"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="flex gap-3 border-t border-slate-200 pt-5">
                    <button
                      type="button"
                      onClick={closePanel}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Creating..."
                        : "Create Parent"}
                    </button>
                  </div>
                </form>
              ) : mode === "edit" &&
                selectedParent ? (
                /* =================================================
                   EDIT PARENT
                   ================================================= */
                <form
                  onSubmit={handleUpdate}
                  className="space-y-5 p-6"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Parent ID
                      </label>

                      <input
                        type="text"
                        value={selectedParent.id}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        User ID
                      </label>

                      <input
                        type="text"
                        value={selectedParent.user_id}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        First Name *
                      </label>

                      <input
                        type="text"
                        value={form.first_name}
                        onChange={(event) =>
                          handleFormChange(
                            "first_name",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Last Name *
                      </label>

                      <input
                        type="text"
                        value={form.last_name}
                        onChange={(event) =>
                          handleFormChange(
                            "last_name",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Phone
                    </label>

                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        handleFormChange(
                          "phone",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Account Status
                    </p>

                    <p
                      className={`mt-2 text-sm font-bold ${
                        selectedParent.is_active
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {selectedParent.is_active
                        ? "Active"
                        : "Inactive"}
                    </p>
                  </div>

                  <div className="flex gap-3 border-t border-slate-200 pt-5">
                    <button
                      type="button"
                      onClick={() => setMode("view")}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Saving..."
                        : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : selectedParent ? (
                /* =================================================
                   VIEW PARENT + CHILDREN
                   ================================================= */
                <div className="space-y-6 p-6">
                  {/* PARENT CARD */}
                  <div className="rounded-2xl bg-slate-950 p-5 text-white">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold">
                        {getInitials(selectedParent)}
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Parent
                        </p>

                        <h3 className="mt-1 text-2xl font-bold">
                          {selectedParent.first_name}{" "}
                          {selectedParent.last_name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          Parent #{selectedParent.id}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PARENT INFO */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Parent ID
                      </p>

                      <p className="mt-1 font-bold text-slate-900">
                        #{selectedParent.id}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        User ID
                      </p>

                      <p className="mt-1 font-bold text-slate-900">
                        #{selectedParent.user_id}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Phone
                      </p>

                      <p className="mt-1 font-bold text-slate-900">
                        {selectedParent.phone ||
                          "Not provided"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Status
                      </p>

                      <p
                        className={`mt-1 font-bold ${
                          selectedParent.is_active
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        {selectedParent.is_active
                          ? "Active"
                          : "Inactive"}
                      </p>
                    </div>
                  </div>

                  {/* =================================================
                     CHILDREN SECTION
                     ================================================= */}
                  <section className="rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-950">
                          Children
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Students linked to this parent.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={openLinkChild}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                      >
                        + Link Student
                      </button>
                    </div>

                    {loadingChildren ? (
                      <div className="p-8 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />

                        <p className="mt-3 text-sm text-slate-500">
                          Loading children...
                        </p>
                      </div>
                    ) : children.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl">
                          👨‍👩‍👧
                        </div>

                        <h4 className="mt-4 font-bold text-slate-900">
                          No children linked
                        </h4>

                        <p className="mt-1 text-sm text-slate-500">
                          Link a student to this parent.
                        </p>

                        <button
                          type="button"
                          onClick={openLinkChild}
                          className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                          + Link Student
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {children.map((relationship) => {
                          const student =
                            relationship.student;

                          const studentName = student
                            ? `${student.first_name} ${student.last_name}`
                            : `Student #${relationship.student_id}`;

                          return (
                            <div
                              key={`${relationship.parent_id}-${relationship.student_id}`}
                              className="p-5"
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                                    {student
                                      ? `${student.first_name?.[0] || ""}${student.last_name?.[0] || ""}`.toUpperCase()
                                      : "ST"}
                                  </div>

                                  <div>
                                    <p className="font-bold text-slate-900">
                                      {studentName}
                                    </p>

                                    {student && (
                                      <>
                                        <p className="mt-0.5 text-xs text-slate-500">
                                          Admission:{" "}
                                          {
                                            student.admission_number
                                          }
                                        </p>

                                        <p className="mt-0.5 text-xs text-slate-500">
                                          Class ID:{" "}
                                          {student.class_id ??
                                            "Not assigned"}
                                        </p>
                                      </>
                                    )}

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                        {
                                          relationship.relation_type
                                        }
                                      </span>

                                      {relationship.is_primary && (
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                          Primary
                                        </span>
                                      )}

                                      {relationship.is_emergency_contact && (
                                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                          Emergency
                                        </span>
                                      )}

                                      {relationship.receives_notifications && (
                                        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700">
                                          Notifications
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditChild(
                                        relationship,
                                      )
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUnlinkChild(
                                        relationship,
                                      )
                                    }
                                    disabled={
                                      unlinkingStudentId ===
                                      relationship.student_id
                                    }
                                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                  >
                                    {unlinkingStudentId ===
                                    relationship.student_id
                                      ? "Unlinking..."
                                      : "Unlink"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* PARENT ACTIONS */}
                  <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
                    <button
                      type="button"
                      onClick={() =>
                        openEdit(selectedParent)
                      }
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      Edit Parent
                    </button>

                    {selectedParent.is_active ? (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {deleting
                          ? "Deactivating..."
                          : "Deactivate"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleReactivate}
                        disabled={saving}
                        className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {saving
                          ? "Reactivating..."
                          : "Reactivate"}
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ==========================================================
           CHILD MODAL
           ========================================================== */}
        {childMode !== "none" && selectedParent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                      Parent → Student
                    </p>

                    <h3 className="mt-1 text-xl font-bold text-slate-950">
                      {childMode === "create"
                        ? "Link Student"
                        : "Edit Relationship"}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {selectedParent.first_name}{" "}
                      {selectedParent.last_name}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeChildForm}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-lg font-bold text-slate-600 hover:bg-slate-200"
                  >
                    ×
                  </button>
                </div>
              </div>

              <form
                onSubmit={
                  childMode === "create"
                    ? handleLinkChild
                    : handleUpdateChild
                }
                className="space-y-5 p-6"
              >
                {/* STUDENT */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Student *
                  </label>

                  {childMode === "edit" &&
                  selectedChild ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-bold text-slate-900">
                        {selectedChild.student
                          ? `${selectedChild.student.first_name} ${selectedChild.student.last_name}`
                          : `Student #${selectedChild.student_id}`}
                      </p>

                      {selectedChild.student && (
                        <p className="mt-1 text-xs text-slate-500">
                          {
                            selectedChild.student
                              .admission_number
                          }
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(event) =>
                          setStudentSearch(
                            event.target.value,
                          )
                        }
                        placeholder="Search student name, admission number..."
                        className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                      />

                      {loadingStudents ? (
                        <div className="rounded-xl border border-slate-200 p-5 text-center">
                          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />

                          <p className="mt-2 text-xs text-slate-500">
                            Loading students...
                          </p>
                        </div>
                      ) : availableStudents.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                          No available students found.
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                          {availableStudents.map(
                            (student) => {
                              const selected =
                                Number(
                                  childForm.student_id,
                                ) === student.id;

                              return (
                                <button
                                  key={student.id}
                                  type="button"
                                  onClick={() =>
                                    handleChildFormChange(
                                      "student_id",
                                      String(
                                        student.id,
                                      ),
                                    )
                                  }
                                  className={`w-full border-b border-slate-100 p-3 text-left last:border-b-0 ${
                                    selected
                                      ? "bg-emerald-50"
                                      : "hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">
                                        {
                                          student.first_name
                                        }{" "}
                                        {
                                          student.last_name
                                        }
                                      </p>

                                      <p className="mt-0.5 text-xs text-slate-500">
                                        {
                                          student.admission_number
                                        }{" "}
                                        · Class ID:{" "}
                                        {student.class_id ??
                                          "—"}
                                      </p>
                                    </div>

                                    {selected && (
                                      <span className="text-sm font-bold text-emerald-600">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            },
                          )}
                        </div>
                      )}

                      {childForm.student_id && (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Selected Student ID:{" "}
                          {childForm.student_id}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* RELATION */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Relation *
                  </label>

                  <select
                    value={childForm.relation_type}
                    onChange={(event) =>
                      handleChildFormChange(
                        "relation_type",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {RELATIONS.map((relation) => (
                      <option
                        key={relation}
                        value={relation}
                      >
                        {relation}
                      </option>
                    ))}
                  </select>
                </div>

                {/* OPTIONS */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Primary Parent
                      </p>

                      <p className="text-xs text-slate-500">
                        Make this parent the primary contact
                        for the student.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={childForm.is_primary}
                      onChange={(event) =>
                        handleChildFormChange(
                          "is_primary",
                          event.target.checked,
                        )
                      }
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Emergency Contact
                      </p>

                      <p className="text-xs text-slate-500">
                        Mark this parent as an emergency contact.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={
                        childForm.is_emergency_contact
                      }
                      onChange={(event) =>
                        handleChildFormChange(
                          "is_emergency_contact",
                          event.target.checked,
                        )
                      }
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Notifications
                      </p>

                      <p className="text-xs text-slate-500">
                        Allow notifications for this parent-child
                        relationship.
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={
                        childForm.receives_notifications
                      }
                      onChange={(event) =>
                        handleChildFormChange(
                          "receives_notifications",
                          event.target.checked,
                        )
                      }
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </label>
                </div>

                {/* ACTIONS */}
                <div className="flex gap-3 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={closeChildForm}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      savingChild ||
                      (childMode === "create" &&
                        !childForm.student_id)
                    }
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingChild
                      ? childMode === "create"
                        ? "Linking..."
                        : "Saving..."
                      : childMode === "create"
                        ? "Link Student"
                        : "Save Relationship"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}