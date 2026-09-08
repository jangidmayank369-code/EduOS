"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type Child = {
  id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_id: number | null;
};

type ParentChild = {
  parent_id: number;
  student_id: number;
  relation_type: string;
  is_primary: boolean;
  is_emergency_contact: boolean;
  receives_notifications: boolean;
  created_at: string;
  updated_at: string;
  student: Child | null;
};

const API_URL = "http://127.0.0.1:8000";

const relationOptions = [
  "FATHER",
  "MOTHER",
  "GUARDIAN",
  "GRANDFATHER",
  "GRANDMOTHER",
  "OTHER",
];

export default function ParentsPage() {
  const router = useRouter();

  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Child[]>([]);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [children, setChildren] = useState<ParentChild[]>([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showParentModal, setShowParentModal] = useState(false);
  const [showChildModal, setShowChildModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [relationshipToRemove, setRelationshipToRemove] =
    useState<ParentChild | null>(null);

  const [parentForm, setParentForm] = useState({
    user_id: "",
    first_name: "",
    last_name: "",
    phone: "",
    is_active: true,
  });

  const [childForm, setChildForm] = useState({
    student_id: "",
    relation_type: "GUARDIAN",
    is_primary: false,
    is_emergency_contact: false,
    receives_notifications: true,
  });

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token ?? ""}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleResponseError = async (response: Response) => {
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired");
    }

    let message = "Something went wrong.";

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data?.detail)) {
        message = data.detail
          .map((item: { msg?: string }) => item.msg)
          .filter(Boolean)
          .join(", ");
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  };

  const loadParents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/parents/`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        await handleResponseError(response);
        return;
      }

      const data = await response.json();
      setParents(data);
    } catch (err) {
      if (err instanceof Error && err.message !== "Session expired") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const response = await fetch(`${API_URL}/students/`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        await handleResponseError(response);
        return;
      }

      const data = await response.json();
      setStudents(data);
    } catch {
      // Parent page can still render even if student loading fails.
    }
  };

  const loadChildren = async (parent: Parent) => {
    try {
      setChildrenLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/parent-children/parent/${parent.id}`,
        {
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        await handleResponseError(response);
        return;
      }

      const data = await response.json();

      setChildren(data);
    } catch (err) {
      if (err instanceof Error && err.message !== "Session expired") {
        setError(err.message);
      }
    } finally {
      setChildrenLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    loadParents();
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredParents = parents.filter((parent) => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return (
      `${parent.first_name} ${parent.last_name}`
        .toLowerCase()
        .includes(query) ||
      String(parent.user_id).includes(query) ||
      (parent.phone ?? "").toLowerCase().includes(query)
    );
  });

  const openCreateParent = () => {
    clearMessages();

    setEditingParent(null);

    setParentForm({
      user_id: "",
      first_name: "",
      last_name: "",
      phone: "",
      is_active: true,
    });

    setShowParentModal(true);
  };

  const openEditParent = (parent: Parent) => {
    clearMessages();

    setEditingParent(parent);

    setParentForm({
      user_id: String(parent.user_id),
      first_name: parent.first_name,
      last_name: parent.last_name,
      phone: parent.phone ?? "",
      is_active: parent.is_active,
    });

    setShowParentModal(true);
  };

  const handleParentSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      clearMessages();

      if (!parentForm.first_name.trim()) {
        setError("First name is required.");
        return;
      }

      if (!parentForm.last_name.trim()) {
        setError("Last name is required.");
        return;
      }

      if (!editingParent && !parentForm.user_id.trim()) {
        setError("User ID is required for a new parent.");
        return;
      }

      const payload = editingParent
        ? {
            first_name: parentForm.first_name.trim(),
            last_name: parentForm.last_name.trim(),
            phone: parentForm.phone.trim() || null,
            is_active: parentForm.is_active,
          }
        : {
            user_id: Number(parentForm.user_id),
            first_name: parentForm.first_name.trim(),
            last_name: parentForm.last_name.trim(),
            phone: parentForm.phone.trim() || null,
          };

      const response = await fetch(
        editingParent
          ? `${API_URL}/parents/${editingParent.id}`
          : `${API_URL}/parents/`,
        {
          method: editingParent ? "PUT" : "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        await handleResponseError(response);
        return;
      }

      const savedParent: Parent = await response.json();

      setSuccess(
        editingParent
          ? "Parent updated successfully."
          : "Parent created successfully."
      );

      setShowParentModal(false);

      await loadParents();

      if (selectedParent?.id === savedParent.id) {
        setSelectedParent(savedParent);
        await loadChildren(savedParent);
      }
    } catch (err) {
      if (err instanceof Error && err.message !== "Session expired") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const openParentDetails = async (parent: Parent) => {
    clearMessages();
    setSelectedParent(parent);
    await loadChildren(parent);
  };

  const openChildModal = () => {
    if (!selectedParent) {
      return;
    }

    clearMessages();

    setChildForm({
      student_id: "",
      relation_type: "GUARDIAN",
      is_primary: false,
      is_emergency_contact: false,
      receives_notifications: true,
    });

    setShowChildModal(true);
  };

  const handleChildSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedParent) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      if (!childForm.student_id) {
        setError("Please select a student.");
        return;
      }

      const payload = {
        parent_id: selectedParent.id,
        student_id: Number(childForm.student_id),
        relation_type: childForm.relation_type,
        is_primary: childForm.is_primary,
        is_emergency_contact: childForm.is_emergency_contact,
        receives_notifications: childForm.receives_notifications,
      };

      const response = await fetch(`${API_URL}/parent-children/`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        await handleResponseError(response);
        return;
      }

      setSuccess("Child linked to parent successfully.");
      setShowChildModal(false);

      await loadChildren(selectedParent);
    } catch (err) {
      if (err instanceof Error && err.message !== "Session expired") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const updateRelationship = async (
    relationship: ParentChild,
    changes: Partial<{
      relation_type: string;
      is_primary: boolean;
      is_emergency_contact: boolean;
      receives_notifications: boolean;
    }>
  ) => {
    try {
      clearMessages();

      const response = await fetch(
        `${API_URL}/parent-children/${relationship.parent_id}/${relationship.student_id}`,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(changes),
        }
      );

      if (!response.ok) {
        await handleResponseError(response);
        return;
      }

      setSuccess("Relationship updated successfully.");

      if (selectedParent) {
        await loadChildren(selectedParent);
      }
    } catch (err) {
      if (err instanceof Error && err.message !== "Session expired") {
        setError(err.message);
      }
    }
  };

  const confirmUnlink = (relationship: ParentChild) => {
    clearMessages();
    setRelationshipToRemove(relationship);
    setShowUnlinkModal(true);
  };

  const handleUnlink = async () => {
    if (!relationshipToRemove) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const response = await fetch(
        `${API_URL}/parent-children/${relationshipToRemove.parent_id}/${relationshipToRemove.student_id}`,
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        await handleResponseError(response);
        return;
      }

      setSuccess("Parent-child relationship removed successfully.");
      setShowUnlinkModal(false);
      setRelationshipToRemove(null);

      if (selectedParent) {
        await loadChildren(selectedParent);
      }
    } catch (err) {
      if (err instanceof Error && err.message !== "Session expired") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = (parent: Parent) => {
    clearMessages();
    setEditingParent(parent);
    setShowDeleteModal(true);
  };

  const handleDeactivate = async () => {
    if (!editingParent) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const response = await fetch(
        `${API_URL}/parents/${editingParent.id}`,
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        await handleResponseError(response);
        return;
      }

      setSuccess("Parent deactivated successfully.");
      setShowDeleteModal(false);

      if (selectedParent?.id === editingParent.id) {
        setSelectedParent(null);
        setChildren([]);
      }

      setEditingParent(null);

      await loadParents();
    } catch (err) {
      if (err instanceof Error && err.message !== "Session expired") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const totalParents = parents.length;

  const parentsWithChildren = new Set(
    parents
      .filter((parent) => selectedParent?.id === parent.id)
      .map((parent) => parent.id)
  );

  const primaryChildrenCount = children.filter(
    (child) => child.is_primary
  ).length;

  const emergencyContactsCount = children.filter(
    (child) => child.is_emergency_contact
  ).length;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Family Management
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              Parents & Guardians
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Manage parent accounts, family relationships, emergency contacts
              and communication preferences.
            </p>
          </div>

          <button
            onClick={openCreateParent}
            className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#17396f]"
          >
            + Add Parent
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="font-bold text-red-500"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span>{success}</span>
            <button
              onClick={() => setSuccess("")}
              className="font-bold text-emerald-600"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Parents
            </p>
            <p className="mt-2 text-3xl font-bold text-[#102A56]">
              {totalParents}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Linked Children
            </p>
            <p className="mt-2 text-3xl font-bold text-[#102A56]">
              {selectedParent ? children.length : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Primary Contacts
            </p>
            <p className="mt-2 text-3xl font-bold text-[#102A56]">
              {selectedParent ? primaryChildrenCount : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Emergency Contacts
            </p>
            <p className="mt-2 text-3xl font-bold text-[#102A56]">
              {selectedParent ? emergencyContactsCount : "—"}
            </p>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          {/* Parent list */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-[#102A56]">Parent Directory</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Select a parent to manage their children.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search parents..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-400">
                Loading parents...
              </div>
            ) : filteredParents.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                  👨‍👩‍👧
                </div>
                <p className="mt-4 font-semibold text-slate-700">
                  No parents found
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Add a parent or change your search.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredParents.map((parent) => {
                  const selected = selectedParent?.id === parent.id;

                  return (
                    <div
                      key={parent.id}
                      className={`group flex flex-col gap-4 p-5 transition sm:flex-row sm:items-center sm:justify-between ${
                        selected ? "bg-blue-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <button
                        onClick={() => openParentDetails(parent)}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#102A56] text-sm font-bold text-white">
                          {parent.first_name.charAt(0)}
                          {parent.last_name.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-[#102A56]">
                              {parent.first_name} {parent.last_name}
                            </h3>

                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                              Active
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-400">
                            User ID: {parent.user_id}
                            {parent.phone ? ` • ${parent.phone}` : ""}
                          </p>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => openEditParent(parent)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => confirmDeactivate(parent)}
                          className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                        >
                          Deactivate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Parent details */}
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {!selectedParent ? (
              <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-3xl">
                  👨‍👩‍👧
                </div>

                <h2 className="mt-5 font-bold text-[#102A56]">
                  Select a parent
                </h2>

                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
                  Choose a parent from the directory to view and manage their
                  children.
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#102A56] text-sm font-bold text-white">
                        {selectedParent.first_name.charAt(0)}
                        {selectedParent.last_name.charAt(0)}
                      </div>

                      <div className="min-w-0">
                        <h2 className="truncate font-bold text-[#102A56]">
                          {selectedParent.first_name}{" "}
                          {selectedParent.last_name}
                        </h2>
                        <p className="text-xs text-slate-400">
                          Parent #{selectedParent.id}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openChildModal}
                      className="shrink-0 rounded-xl bg-[#102A56] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#17396f]"
                    >
                      + Child
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        User ID
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {selectedParent.user_id}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Phone
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                        {selectedParent.phone || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-[#102A56]">
                        Children & Relationships
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Family links and communication settings.
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600">
                      {children.length}
                    </span>
                  </div>

                  {childrenLoading ? (
                    <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-400">
                      Loading children...
                    </div>
                  ) : children.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                      <p className="font-semibold text-slate-600">
                        No children linked
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Use &quot;+ Child&quot; to create a family
                        relationship.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {children.map((relationship) => (
                        <div
                          key={`${relationship.parent_id}-${relationship.student_id}`}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                                {relationship.student?.first_name?.charAt(0) ||
                                  "S"}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-700">
                                  {relationship.student
                                    ? `${relationship.student.first_name} ${relationship.student.last_name}`
                                    : `Student #${relationship.student_id}`}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {relationship.student?.admission_number ||
                                    `ID ${relationship.student_id}`}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => confirmUnlink(relationship)}
                              className="text-xs font-semibold text-red-500 hover:text-red-700"
                            >
                              Unlink
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                              {relationship.relation_type}
                            </span>

                            {relationship.is_primary && (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">
                                Primary
                              </span>
                            )}

                            {relationship.is_emergency_contact && (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                                Emergency
                              </span>
                            )}

                            {relationship.receives_notifications && (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                                Notifications
                              </span>
                            )}
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <select
                              value={relationship.relation_type}
                              onChange={(event) =>
                                updateRelationship(relationship, {
                                  relation_type: event.target.value,
                                })
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-400"
                            >
                              {relationOptions.map((relation) => (
                                <option key={relation} value={relation}>
                                  {relation}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() =>
                                updateRelationship(relationship, {
                                  is_primary: !relationship.is_primary,
                                })
                              }
                              className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                                relationship.is_primary
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                              }`}
                            >
                              {relationship.is_primary
                                ? "✓ Primary"
                                : "Set Primary"}
                            </button>

                            <button
                              onClick={() =>
                                updateRelationship(relationship, {
                                  receives_notifications:
                                    !relationship.receives_notifications,
                                })
                              }
                              className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                                relationship.receives_notifications
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                              }`}
                            >
                              {relationship.receives_notifications
                                ? "✓ Notify"
                                : "No Notify"}
                            </button>
                          </div>

                          <button
                            onClick={() =>
                              updateRelationship(relationship, {
                                is_emergency_contact:
                                  !relationship.is_emergency_contact,
                              })
                            }
                            className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              relationship.is_emergency_contact
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                            }`}
                          >
                            {relationship.is_emergency_contact
                              ? "✓ Emergency Contact"
                              : "Set as Emergency Contact"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      {/* Parent Modal */}
      {showParentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-bold text-[#102A56]">
                {editingParent ? "Edit Parent" : "Add Parent"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {editingParent
                  ? "Update the parent profile."
                  : "Create a parent profile using an existing parent user account."}
              </p>
            </div>

            <form onSubmit={handleParentSubmit} className="space-y-4 p-5">
              {!editingParent && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    User ID *
                  </label>
                  <input
                    type="number"
                    value={parentForm.user_id}
                    onChange={(event) =>
                      setParentForm({
                        ...parentForm,
                        user_id: event.target.value,
                      })
                    }
                    placeholder="Existing parent user ID"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    This must belong to an active user whose role is
                    <strong> parent</strong>.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    First Name *
                  </label>
                  <input
                    value={parentForm.first_name}
                    onChange={(event) =>
                      setParentForm({
                        ...parentForm,
                        first_name: event.target.value,
                      })
                    }
                    placeholder="First name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Last Name *
                  </label>
                  <input
                    value={parentForm.last_name}
                    onChange={(event) =>
                      setParentForm({
                        ...parentForm,
                        last_name: event.target.value,
                      })
                    }
                    placeholder="Last name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Phone
                </label>
                <input
                  value={parentForm.phone}
                  onChange={(event) =>
                    setParentForm({
                      ...parentForm,
                      phone: event.target.value,
                    })
                  }
                  placeholder="Phone number"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
                />
              </div>

              {editingParent && (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    checked={parentForm.is_active}
                    onChange={(event) =>
                      setParentForm({
                        ...parentForm,
                        is_active: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Parent account is active
                  </span>
                </label>
              )}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowParentModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingParent
                      ? "Save Changes"
                      : "Create Parent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Child Modal */}
      {showChildModal && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-bold text-[#102A56]">
                Link Child
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Link a student to {selectedParent.first_name}{" "}
                {selectedParent.last_name}.
              </p>
            </div>

            <form onSubmit={handleChildSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Student *
                </label>

                <select
                  value={childForm.student_id}
                  onChange={(event) =>
                    setChildForm({
                      ...childForm,
                      student_id: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                  required
                >
                  <option value="">Select student</option>

                  {students
                    .filter(
                      (student) =>
                        !children.some(
                          (child) => child.student_id === student.id
                        )
                    )
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name} —{" "}
                        {student.admission_number}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Relationship *
                </label>

                <select
                  value={childForm.relation_type}
                  onChange={(event) =>
                    setChildForm({
                      ...childForm,
                      relation_type: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                >
                  {relationOptions.map((relation) => (
                    <option key={relation} value={relation}>
                      {relation}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    checked={childForm.is_primary}
                    onChange={(event) =>
                      setChildForm({
                        ...childForm,
                        is_primary: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Primary parent
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    checked={childForm.is_emergency_contact}
                    onChange={(event) =>
                      setChildForm({
                        ...childForm,
                        is_emergency_contact: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Emergency contact
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    checked={childForm.receives_notifications}
                    onChange={(event) =>
                      setChildForm({
                        ...childForm,
                        receives_notifications: event.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Receives school notifications
                  </span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowChildModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Linking..." : "Link Child"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeleteModal && editingParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl">
              !
            </div>

            <h2 className="mt-4 text-lg font-bold text-[#102A56]">
              Deactivate parent?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will deactivate{" "}
              <strong>
                {editingParent.first_name} {editingParent.last_name}
              </strong>
              . Existing family relationships are preserved.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>

              <button
                onClick={handleDeactivate}
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Deactivating..." : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Modal */}
      {showUnlinkModal && relationshipToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-xl">
              !
            </div>

            <h2 className="mt-4 text-lg font-bold text-[#102A56]">
              Remove family relationship?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              The student will be unlinked from this parent. This does not
              delete the parent or student.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowUnlinkModal(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>

              <button
                onClick={handleUnlink}
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Removing..." : "Remove Relationship"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}