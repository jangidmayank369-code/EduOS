"use client";

import { useEffect, useMemo, useState } from "react";

type SchoolClass = {
  id: number;
  name: string;
  section?: string | null;
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
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const COMPONENT_TYPES = [
  {
    value: "GRADE",
    label: "Grade",
  },
  {
    value: "MARKS",
    label: "Marks",
  },
  {
    value: "REMARK",
    label: "Remark",
  },
] as const;

const DEFAULT_COMPONENTS = [
  "Social Service",
  "Physical & Health Education",
  "Art Education",
  "General Knowledge",
];

export default function CoScholasticPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [components, setComponents] = useState<CoScholasticComponent[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [componentType, setComponentType] =
    useState<CoScholasticComponent["component_type"]>("GRADE");
  const [maxMarks, setMaxMarks] = useState("");
  const [includeInResult, setIncludeInResult] = useState(false);
  const [displayOrder, setDisplayOrder] = useState("0");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedClass = useMemo(
    () =>
      classes.find(
        (item) => String(item.id) === selectedClassId
      ),
    [classes, selectedClassId]
  );

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadComponents(selectedClassId);
    } else {
      setComponents([]);
    }
  }, [selectedClassId]);

  const getHeaders = () => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;

    return {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    };
  };

  const loadClasses = async () => {
    try {
      setLoadingClasses(true);
      setError("");

      const response = await fetch(`${API_BASE}/classes/`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error("Classes load nahi ho payi.");
      }

      const data = await response.json();

      const activeClasses = Array.isArray(data)
        ? data.filter((item: SchoolClass & { is_active?: boolean }) =>
            item.is_active === undefined ? true : item.is_active
          )
        : [];

      setClasses(activeClasses);

      if (activeClasses.length > 0) {
        setSelectedClassId(String(activeClasses[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Classes load nahi ho payi."
      );
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadComponents = async (classId: string) => {
    try {
      setLoadingComponents(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/co-scholastic/components?class_id=${classId}`,
        {
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Co-Scholastic components load nahi ho paye.");
      }

      const data = await response.json();

      setComponents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Components load nahi ho paye."
      );
      setComponents([]);
    } finally {
      setLoadingComponents(false);
    }
  };

  const resetForm = () => {
    setName("");
    setComponentType("GRADE");
    setMaxMarks("");
    setIncludeInResult(false);
    setDisplayOrder("0");
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setError("");
    setMessage("");
    setEditingId(null);
    setName("");
    setComponentType("GRADE");
    setMaxMarks("");
    setIncludeInResult(false);
    setDisplayOrder(
      String(components.length + 1)
    );
    setShowForm(true);
  };

  const openEditForm = (component: CoScholasticComponent) => {
    setError("");
    setMessage("");

    setEditingId(component.id);
    setName(component.name);
    setComponentType(component.component_type);
    setMaxMarks(
      component.max_marks !== null
        ? String(component.max_marks)
        : ""
    );
    setIncludeInResult(component.include_in_result);
    setDisplayOrder(String(component.display_order));

    setShowForm(true);
  };

  const saveComponent = async () => {
    if (!selectedClassId) {
      setError("Pehle class select karo.");
      return;
    }

    if (!name.trim()) {
      setError("Component name required hai.");
      return;
    }

    if (
      componentType === "MARKS" &&
      maxMarks.trim() &&
      Number(maxMarks) <= 0
    ) {
      setError("Max marks 0 se greater hona chahiye.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        class_id: Number(selectedClassId),
        name: name.trim(),
        component_type: componentType,
        max_marks:
          componentType === "MARKS" && maxMarks.trim()
            ? Number(maxMarks)
            : null,
        include_in_result: includeInResult,
        display_order: Number(displayOrder) || 0,
        is_active: true,
      };

      const url = editingId
        ? `${API_BASE}/co-scholastic/components/${editingId}`
        : `${API_BASE}/co-scholastic/components`;

      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Co-Scholastic component save nahi ho paya."
        );
      }

      setMessage(
        editingId
          ? "Component successfully update ho gaya."
          : "Component successfully add ho gaya."
      );

      resetForm();
      await loadComponents(selectedClassId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Component save nahi ho paya."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteComponent = async (
    component: CoScholasticComponent
  ) => {
    const confirmed = window.confirm(
      `"${component.name}" ko deactivate karna hai?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/co-scholastic/components/${component.id}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Component deactivate nahi ho paya."
        );
      }

      setMessage("Component deactivate ho gaya.");

      await loadComponents(selectedClassId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Component deactivate nahi ho paya."
      );
    }
  };

  const addDefaultComponents = async () => {
    if (!selectedClassId) {
      setError("Pehle class select karo.");
      return;
    }

    const existingNames = new Set(
      components.map((item) => item.name.toLowerCase())
    );

    const missingNames = DEFAULT_COMPONENTS.filter(
      (item) =>
        !existingNames.has(item.toLowerCase())
    );

    if (missingNames.length === 0) {
      setMessage("Default components already added hain.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      for (let index = 0; index < missingNames.length; index++) {
        const response = await fetch(
          `${API_BASE}/co-scholastic/components`,
          {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
              class_id: Number(selectedClassId),
              name: missingNames[index],
              component_type: "GRADE",
              max_marks: null,
              include_in_result: false,
              display_order: components.length + index + 1,
              is_active: true,
            }),
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              `${missingNames[index]} add nahi ho paya.`
          );
        }
      }

      setMessage(
        "Default Co-Scholastic components successfully add ho gaye."
      );

      await loadComponents(selectedClassId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Default components add nahi ho paye."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Academic Setup
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#102A56]">
                Co-Scholastic
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Academic subjects se separate additional assessment
                components configure karein.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={addDefaultComponents}
                disabled={
                  saving ||
                  !selectedClassId ||
                  loadingComponents
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#102A56] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Default Components
              </button>

              <button
                onClick={openCreateForm}
                disabled={!selectedClassId}
                className="rounded-xl bg-[#102A56] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/20 transition hover:bg-[#0c2145] disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add Component
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Alerts */}
        {message && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Class selector */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full max-w-md">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Select Class
              </label>

              <select
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  setMessage("");
                  setError("");
                  resetForm();
                }}
                disabled={loadingClasses}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50"
              >
                {loadingClasses && (
                  <option value="">
                    Loading classes...
                  </option>
                )}

                {!loadingClasses && classes.length === 0 && (
                  <option value="">
                    No classes available
                  </option>
                )}

                {classes.map((schoolClass) => (
                  <option
                    key={schoolClass.id}
                    value={schoolClass.id}
                  >
                    {schoolClass.name}
                    {schoolClass.section
                      ? ` - ${schoolClass.section}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedClass && (
              <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <span className="font-semibold">
                  {selectedClass.name}
                </span>{" "}
                ke liye Co-Scholastic configuration
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#102A56]">
                  {editingId
                    ? "Edit Co-Scholastic Component"
                    : "Add Co-Scholastic Component"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Component academic subjects se independent rahega.
                </p>
              </div>

              <button
                onClick={resetForm}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Component Name
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Social Service"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Assessment Type
                </label>

                <select
                  value={componentType}
                  onChange={(event) =>
                    setComponentType(
                      event.target.value as CoScholasticComponent["component_type"]
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                >
                  {COMPONENT_TYPES.map((type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Max Marks
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxMarks}
                  onChange={(event) =>
                    setMaxMarks(event.target.value)
                  }
                  disabled={componentType !== "MARKS"}
                  placeholder={
                    componentType === "MARKS"
                      ? "e.g. 20"
                      : "Not applicable"
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Display Order
                </label>

                <input
                  type="number"
                  min="0"
                  value={displayOrder}
                  onChange={(event) =>
                    setDisplayOrder(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Include in Final Result
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Normally Co-Scholastic academic result calculation
                  se separate rahega.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIncludeInResult((value) => !value)
                }
                className={`relative h-6 w-11 rounded-full transition ${
                  includeInResult
                    ? "bg-[#102A56]"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                    includeInResult
                      ? "left-6"
                      : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={saveComponent}
                disabled={saving}
                className="rounded-xl bg-[#102A56] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/20 hover:bg-[#0c2145] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Component"
                    : "Save Component"}
              </button>
            </div>
          </div>
        )}

        {/* Components */}
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#102A56]">
                Components
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedClass
                  ? `${selectedClass.name} ke active Co-Scholastic components`
                  : "Class select karein"}
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
              {components.length} Components
            </div>
          </div>

          {loadingComponents ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#102A56]" />

              <p className="mt-4 text-sm text-slate-500">
                Components load ho rahe hain...
              </p>
            </div>
          ) : !selectedClassId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-sm font-medium text-slate-500">
                Pehle class select karein.
              </p>
            </div>
          ) : components.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#102A56]">
                ◇
              </div>

              <h3 className="mt-4 text-base font-bold text-[#102A56]">
                No Co-Scholastic Components
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Is class ke liye abhi koi Co-Scholastic component
                configured nahi hai.
              </p>

              <div className="mt-5 flex justify-center gap-3">
                <button
                  onClick={addDefaultComponents}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#102A56] hover:bg-slate-50 disabled:opacity-50"
                >
                  Add Default Components
                </button>

                <button
                  onClick={openCreateForm}
                  className="rounded-xl bg-[#102A56] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2145]"
                >
                  Add Component
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        #
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Component
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Type
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Max Marks
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Final Result
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {[...components]
                      .sort(
                        (a, b) =>
                          a.display_order - b.display_order
                      )
                      .map((component, index) => (
                        <tr
                          key={component.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4 text-sm font-semibold text-slate-400">
                            {index + 1}
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-semibold text-[#102A56]">
                              {component.name}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              Order: {component.display_order}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                              {component.component_type}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-slate-600">
                            {component.max_marks !== null
                              ? component.max_marks
                              : "—"}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                component.include_in_result
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {component.include_in_result
                                ? "Included"
                                : "Separate"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  openEditForm(component)
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#102A56] hover:bg-blue-50"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() =>
                                  deleteComponent(component)
                                }
                                className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}