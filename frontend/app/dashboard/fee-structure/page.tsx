"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://127.0.0.1:8000";

type AcademicSession = {
  id: number;
  name?: string;
  year?: string;
  is_active?: boolean;
};

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
};

type FeeStructure = {
  id: number;
  academic_session_id: number;
  class_id: number;
  name: string;
  description: string | null;
  amount: number;
  frequency: string;
  due_day: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FeeForm = {
  academic_session_id: string;
  class_id: string;
  name: string;
  description: string;
  amount: string;
  frequency: string;
  due_day: string;
};

const emptyForm: FeeForm = {
  academic_session_id: "",
  class_id: "",
  name: "",
  description: "",
  amount: "",
  frequency: "YEARLY",
  due_day: "",
};

export default function FeeStructuresPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStructure, setEditingStructure] =
    useState<FeeStructure | null>(null);
  const [form, setForm] = useState<FeeForm>(emptyForm);

  const [deleteTarget, setDeleteTarget] =
    useState<FeeStructure | null>(null);

  const [generateTarget, setGenerateTarget] =
    useState<FeeStructure | null>(null);
  const [generateClassId, setGenerateClassId] = useState("");
  const [generateSessionId, setGenerateSessionId] = useState("");

  const [generationResult, setGenerationResult] = useState<{
    generated: number;
    skipped: number;
    message: string;
  } | null>(null);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const headers = () => ({
    Authorization: `Bearer ${
      localStorage.getItem("access_token") || ""
    }`,
    "Content-Type": "application/json",
  });

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const parseError = async (response: Response) => {
    if (response.status === 401) {
      logout();
      throw new Error("Session expired");
    }

    let message = "Something went wrong.";

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data?.detail)) {
        message = data.detail
          .map((item: any) => item?.msg || "Validation error")
          .join(", ");
      }
    } catch {
      // Keep default message.
    }

    throw new Error(message);
  };

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [sessionResponse, classResponse, structureResponse] =
        await Promise.all([
          fetch(`${API_BASE}/academic-sessions/`, {
            headers: headers(),
          }),
          fetch(`${API_BASE}/classes/`, {
            headers: headers(),
          }),
          fetch(
            `${API_BASE}/fee-structures/?active_only=${activeOnly}`,
            {
              headers: headers(),
            },
          ),
        ]);

      if (!sessionResponse.ok) {
        await parseError(sessionResponse);
      }

      if (!classResponse.ok) {
        await parseError(classResponse);
      }

      if (!structureResponse.ok) {
        await parseError(structureResponse);
      }

      const sessionData = await sessionResponse.json();
      const classData = await classResponse.json();
      const structureData = await structureResponse.json();

      setSessions(
        Array.isArray(sessionData) ? sessionData : [],
      );

      setClasses(
        Array.isArray(classData) ? classData : [],
      );

      setStructures(
        Array.isArray(structureData) ? structureData : [],
      );
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message || "Unable to load fee structures.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!token) return;

    loadData();
  }, [activeOnly]);

  const sessionMap = useMemo(() => {
    const map = new Map<number, string>();

    sessions.forEach((session) => {
      map.set(
        session.id,
        session.name ||
          session.year ||
          `Session ${session.id}`,
      );
    });

    return map;
  }, [sessions]);

  const classMap = useMemo(() => {
    const map = new Map<number, string>();

    classes.forEach((item) => {
      map.set(item.id, item.name);
    });

    return map;
  }, [classes]);

  const filteredStructures = useMemo(() => {
    const query = search.trim().toLowerCase();

    return structures.filter((item) => {
      if (
        sessionFilter &&
        String(item.academic_session_id) !== sessionFilter
      ) {
        return false;
      }

      if (
        classFilter &&
        String(item.class_id) !== classFilter
      ) {
        return false;
      }

      if (query) {
        const sessionName =
          sessionMap
            .get(item.academic_session_id)
            ?.toLowerCase() || "";

        const className =
          classMap.get(item.class_id)?.toLowerCase() || "";

        const matches =
          item.name.toLowerCase().includes(query) ||
          item.frequency.toLowerCase().includes(query) ||
          sessionName.includes(query) ||
          className.includes(query);

        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [
    structures,
    search,
    sessionFilter,
    classFilter,
    sessionMap,
    classMap,
  ]);

  const activeCount = structures.filter(
    (item) => item.is_active,
  ).length;

  const totalStructureAmount = structures.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const showSuccess = (message: string) => {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3500);
  };

  const openCreate = () => {
    setEditingStructure(null);

    const activeSession =
      sessions.find((session) => session.is_active) ||
      sessions[0];

    setForm({
      ...emptyForm,
      academic_session_id: activeSession
        ? String(activeSession.id)
        : "",
    });

    setFormOpen(true);
    setError("");
  };

  const openEdit = (structure: FeeStructure) => {
    setEditingStructure(structure);

    setForm({
      academic_session_id: String(
        structure.academic_session_id,
      ),
      class_id: String(structure.class_id),
      name: structure.name,
      description: structure.description || "",
      amount: String(structure.amount),
      frequency: structure.frequency,
      due_day:
        structure.due_day !== null
          ? String(structure.due_day)
          : "",
    });

    setFormOpen(true);
    setError("");
  };

  const saveStructure = async () => {
    if (!form.academic_session_id) {
      setError("Academic session is required.");
      return;
    }

    if (!form.class_id) {
      setError("Class is required.");
      return;
    }

    if (!form.name.trim()) {
      setError("Fee structure name is required.");
      return;
    }

    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      setError("Enter a valid fee amount.");
      return;
    }

    const dueDay = form.due_day
      ? Number(form.due_day)
      : null;

    if (
      dueDay !== null &&
      (!Number.isInteger(dueDay) ||
        dueDay < 1 ||
        dueDay > 31)
    ) {
      setError("Due day must be between 1 and 31.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const payload = {
        academic_session_id: Number(
          form.academic_session_id,
        ),
        class_id: Number(form.class_id),
        name: form.name.trim(),
        description: form.description.trim() || null,
        amount,
        frequency: form.frequency.trim().toUpperCase(),
        due_day: dueDay,
      };

      const url = editingStructure
        ? `${API_BASE}/fee-structures/${editingStructure.id}`
        : `${API_BASE}/fee-structures/`;

      const response = await fetch(url, {
        method: editingStructure ? "PUT" : "POST",
        headers: headers(),
        body: JSON.stringify(
          editingStructure
            ? {
                ...payload,
                is_active: editingStructure.is_active,
              }
            : payload,
        ),
      });

      if (!response.ok) {
        await parseError(response);
      }

      setFormOpen(false);

      showSuccess(
        editingStructure
          ? "Fee structure updated successfully."
          : "Fee structure created successfully.",
      );

      await loadData();
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message ||
            "Unable to save fee structure.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const deactivateStructure = async () => {
    if (!deleteTarget) return;

    setActionLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/fee-structures/${deleteTarget.id}`,
        {
          method: "DELETE",
          headers: headers(),
        },
      );

      if (!response.ok) {
        await parseError(response);
      }

      setDeleteTarget(null);

      showSuccess(
        "Fee structure deactivated successfully.",
      );

      await loadData();
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message ||
            "Unable to deactivate fee structure.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openGenerate = (structure: FeeStructure) => {
    setGenerateTarget(structure);

    setGenerateClassId(String(structure.class_id));
    setGenerateSessionId(
      String(structure.academic_session_id),
    );

    setGenerationResult(null);
    setError("");
  };

  const generateFees = async () => {
    if (!generateTarget) return;

    if (!generateClassId || !generateSessionId) {
      setError(
        "Class and academic session are required.",
      );
      return;
    }

    if (
      Number(generateClassId) !==
      generateTarget.class_id
    ) {
      setError(
        "Selected class does not match this fee structure.",
      );
      return;
    }

    if (
      Number(generateSessionId) !==
      generateTarget.academic_session_id
    ) {
      setError(
        "Selected academic session does not match this fee structure.",
      );
      return;
    }

    setActionLoading(true);
    setError("");
    setGenerationResult(null);

    try {
      const response = await fetch(
        `${API_BASE}/fees/generate`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            fee_structure_id: generateTarget.id,
            academic_session_id: Number(
              generateSessionId,
            ),
            class_id: Number(generateClassId),
          }),
        },
      );

      if (!response.ok) {
        await parseError(response);
      }

      const result = await response.json();

      setGenerationResult({
        generated: Number(result.generated || 0),
        skipped: Number(result.skipped || 0),
        message: result.message || "",
      });

      showSuccess(
        `${result.generated || 0} fee(s) generated successfully.`,
      );
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(
          err?.message ||
            "Unable to generate fees.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatMoney = (amount: number) =>
    `₹${Number(amount || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Finance Setup
              </p>

              <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Fee Structures
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Define fees once for a class and generate them
                for enrolled students in one action.
              </p>
            </div>

            <button
              onClick={openCreate}
              className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#16396f]"
            >
              + Create Fee Structure
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{error}</span>

              <button
                onClick={() => setError("")}
                className="font-bold"
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {success}
            </div>
          )}

          {/* Summary */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Active Structures"
              value={String(activeCount)}
              icon="₹"
            />

            <SummaryCard
              label="Total Structures"
              value={String(structures.length)}
              icon="▤"
            />

            <SummaryCard
              label="Configured Amount"
              value={formatMoney(totalStructureAmount)}
              icon="Σ"
            />
          </div>

          {/* Filters */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px_auto]">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search fee, class or session..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <select
                value={sessionFilter}
                onChange={(e) =>
                  setSessionFilter(e.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
              >
                <option value="">All Sessions</option>

                {sessions.map((session) => (
                  <option
                    key={session.id}
                    value={session.id}
                  >
                    {session.name ||
                      session.year ||
                      `Session ${session.id}`}
                  </option>
                ))}
              </select>

              <select
                value={classFilter}
                onChange={(e) =>
                  setClassFilter(e.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
              >
                <option value="">All Classes</option>

                {classes.map((schoolClass) => (
                  <option
                    key={schoolClass.id}
                    value={schoolClass.id}
                  >
                    {schoolClass.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setActiveOnly((value) => !value)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  activeOnly
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {activeOnly
                  ? "● Active Only"
                  : "○ Including Inactive"}
              </button>
            </div>
          </section>

          {/* Structures */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-bold text-[#102A56]">
                  Fee Structures
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  {filteredStructures.length} structure
                  {filteredStructures.length === 1
                    ? ""
                    : "s"} visible
                </p>
              </div>
            </div>

            {loading ? (
              <div className="px-5 py-16 text-center text-sm text-slate-400">
                Loading fee structures...
              </div>
            ) : filteredStructures.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-[#102A56]">
                  ₹
                </div>

                <p className="font-semibold text-slate-700">
                  No fee structures found
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Create one fee structure and reuse it
                  across the class.
                </p>

                <button
                  onClick={openCreate}
                  className="mt-4 rounded-lg bg-[#102A56] px-4 py-2 text-xs font-semibold text-white"
                >
                  + Create Fee Structure
                </button>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Fee
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Class
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Session
                        </th>

                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Amount
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Frequency
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Status
                        </th>

                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredStructures.map((structure) => (
                        <tr
                          key={structure.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-slate-800">
                              {structure.name}
                            </p>

                            {structure.description && (
                              <p className="mt-1 max-w-[260px] truncate text-xs text-slate-400">
                                {structure.description}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-slate-700">
                            {classMap.get(
                              structure.class_id,
                            ) || "Unknown class"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {sessionMap.get(
                              structure.academic_session_id,
                            ) || "Unknown session"}
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-bold text-[#102A56]">
                            {formatMoney(structure.amount)}
                          </td>

                          <td className="px-5 py-4">
                            <div>
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                                {structure.frequency}
                              </span>

                              {structure.due_day && (
                                <p className="mt-1 text-[10px] text-slate-400">
                                  Due day{" "}
                                  {structure.due_day}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                structure.is_active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {structure.is_active
                                ? "ACTIVE"
                                : "INACTIVE"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              {structure.is_active && (
                                <button
                                  onClick={() =>
                                    openGenerate(
                                      structure,
                                    )
                                  }
                                  className="rounded-lg bg-[#102A56] px-3 py-2 text-xs font-semibold text-white hover:bg-[#16396f]"
                                >
                                  Generate
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  openEdit(structure)
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              {structure.is_active && (
                                <button
                                  onClick={() =>
                                    setDeleteTarget(
                                      structure,
                                    )
                                  }
                                  className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="divide-y divide-slate-100 lg:hidden">
                  {filteredStructures.map((structure) => (
                    <div
                      key={structure.id}
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">
                            {structure.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {classMap.get(
                              structure.class_id,
                            ) || "Unknown class"}
                            {" · "}
                            {sessionMap.get(
                              structure.academic_session_id,
                            ) || "Unknown session"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            structure.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {structure.is_active
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3">
                        <MobileValue
                          label="Amount"
                          value={formatMoney(
                            structure.amount,
                          )}
                        />

                        <MobileValue
                          label="Frequency"
                          value={structure.frequency}
                        />

                        <MobileValue
                          label="Due Day"
                          value={
                            structure.due_day
                              ? String(
                                  structure.due_day,
                                )
                              : "—"
                          }
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {structure.is_active && (
                          <button
                            onClick={() =>
                              openGenerate(structure)
                            }
                            className="rounded-lg bg-[#102A56] px-3 py-2.5 text-xs font-semibold text-white"
                          >
                            Generate Fees
                          </button>
                        )}

                        <button
                          onClick={() =>
                            openEdit(structure)
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600"
                        >
                          Edit
                        </button>

                        {structure.is_active && (
                          <button
                            onClick={() =>
                              setDeleteTarget(
                                structure,
                              )
                            }
                            className="col-span-2 rounded-lg border border-red-100 px-3 py-2.5 text-xs font-semibold text-red-600"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Create / Edit */}
      {formOpen && (
        <Modal
          title={
            editingStructure
              ? "Edit Fee Structure"
              : "Create Fee Structure"
          }
          subtitle={
            editingStructure
              ? "Update the reusable fee configuration."
              : "Create once and use it to generate fees for enrolled students."
          }
          onClose={() => setFormOpen(false)}
        >
          <div className="space-y-4">
            <SelectField
              label="Academic Session"
              value={form.academic_session_id}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  academic_session_id: value,
                }))
              }
              options={sessions.map((session) => ({
                value: String(session.id),
                label:
                  session.name ||
                  session.year ||
                  `Session ${session.id}`,
              }))}
              placeholder="Select session"
            />

            <SelectField
              label="Class"
              value={form.class_id}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  class_id: value,
                }))
              }
              options={classes.map((schoolClass) => ({
                value: String(schoolClass.id),
                label: schoolClass.name,
              }))}
              placeholder="Select class"
            />

            <InputField
              label="Fee Name"
              placeholder="e.g. Annual Fee"
              value={form.name}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  name: value,
                }))
              }
            />

            <InputField
              label="Amount"
              type="number"
              placeholder="25000"
              value={form.amount}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  amount: value,
                }))
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Frequency"
                value={form.frequency}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    frequency: value,
                  }))
                }
                options={[
                  {
                    value: "YEARLY",
                    label: "Yearly",
                  },
                  {
                    value: "HALF_YEARLY",
                    label: "Half Yearly",
                  },
                  {
                    value: "QUARTERLY",
                    label: "Quarterly",
                  },
                  {
                    value: "MONTHLY",
                    label: "Monthly",
                  },
                  {
                    value: "ONE_TIME",
                    label: "One Time",
                  },
                ]}
              />

              <InputField
                label="Due Day"
                type="number"
                placeholder="1 - 31"
                value={form.due_day}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    due_day: value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Description
              </label>

              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                rows={3}
                placeholder="Optional description..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-700">
              <strong>Workflow:</strong> this structure can
              later be used to generate fees for all active
              enrollments in the selected class.
            </div>

            <button
              onClick={saveStructure}
              disabled={actionLoading}
              className="w-full rounded-xl bg-[#102A56] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionLoading
                ? "Saving..."
                : editingStructure
                  ? "Save Changes"
                  : "Create Fee Structure"}
            </button>
          </div>
        </Modal>
      )}

      {/* Generate */}
      {generateTarget && (
        <Modal
          title="Generate Class Fees"
          subtitle="One action creates missing fee records for active enrollments."
          onClose={() => {
            if (!actionLoading) {
              setGenerateTarget(null);
              setGenerationResult(null);
            }
          }}
        >
          <div className="space-y-5">
            <div className="rounded-2xl bg-[#102A56] p-5 text-white">
              <p className="text-xs text-blue-100">
                Fee Structure
              </p>

              <p className="mt-1 text-lg font-bold">
                {generateTarget.name}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[10px] text-blue-100">
                    Amount
                  </p>

                  <p className="mt-1 font-bold">
                    {formatMoney(
                      generateTarget.amount,
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[10px] text-blue-100">
                    Frequency
                  </p>

                  <p className="mt-1 font-bold">
                    {generateTarget.frequency}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                What will happen?
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700">
                EduOS will check active enrollments for the
                selected class and academic session. Existing
                fee records for this structure will be skipped,
                so running the action again will not create
                duplicates.
              </p>
            </div>

            <SelectField
              label="Academic Session"
              value={generateSessionId}
              onChange={setGenerateSessionId}
              options={sessions.map((session) => ({
                value: String(session.id),
                label:
                  session.name ||
                  session.year ||
                  `Session ${session.id}`,
              }))}
            />

            <SelectField
              label="Class"
              value={generateClassId}
              onChange={setGenerateClassId}
              options={classes.map((schoolClass) => ({
                value: String(schoolClass.id),
                label: schoolClass.name,
              }))}
            />

            <button
              onClick={generateFees}
              disabled={actionLoading}
              className="w-full rounded-xl bg-[#102A56] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionLoading
                ? "Generating..."
                : "Generate Fees"}
            </button>

            {generationResult && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-bold text-emerald-800">
                  Generation completed
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <ResultBox
                    label="Generated"
                    value={generationResult.generated}
                    positive
                  />

                  <ResultBox
                    label="Skipped"
                    value={generationResult.skipped}
                  />
                </div>

                {generationResult.message && (
                  <p className="mt-4 text-xs leading-5 text-emerald-700">
                    {generationResult.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Deactivate */}
      {deleteTarget && (
        <Modal
          title="Deactivate Fee Structure"
          subtitle="The structure will no longer be available for new generation."
          onClose={() => {
            if (!actionLoading) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="space-y-5">
            <div className="rounded-xl bg-red-50 p-4">
              <p className="font-semibold text-red-800">
                {deleteTarget.name}
              </p>

              <p className="mt-1 text-xs text-red-600">
                {classMap.get(deleteTarget.class_id) ||
                  "Class"}{" "}
                ·{" "}
                {sessionMap.get(
                  deleteTarget.academic_session_id,
                ) || "Academic session"}
              </p>
            </div>

            <p className="text-sm leading-6 text-slate-600">
              Are you sure you want to deactivate this fee
              structure? Existing generated fees are not deleted.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>

              <button
                onClick={deactivateStructure}
                disabled={actionLoading}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actionLoading
                  ? "Deactivating..."
                  : "Deactivate"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          {label}
        </span>

        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-[#102A56]">
          {icon}
        </span>
      </div>

      <p className="mt-4 text-2xl font-bold tracking-tight text-[#102A56]">
        {value}
      </p>
    </div>
  );
}

function MobileValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-xs font-bold text-slate-700">
        {value}
      </p>
    </div>
  );
}

function ResultBox({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-xl font-bold ${
          positive
            ? "text-emerald-600"
            : "text-slate-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InputField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
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
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-bold text-[#102A56]">
              {title}
            </h3>

            {subtitle && (
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-500 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
