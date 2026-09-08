"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://127.0.0.1:8000";

type AcademicSession = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SessionForm = {
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

const emptyForm: SessionForm = {
  name: "",
  start_date: "",
  end_date: "",
  is_active: false,
};

export default function AcademicSessionsPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [form, setForm] = useState<SessionForm>(emptyForm);
  const [editingSession, setEditingSession] =
    useState<AcademicSession | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE}/academic-sessions/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (response.status === 403) {
        throw new Error("You do not have permission to manage academic sessions.");
      }

      if (!response.ok) {
        throw new Error("Failed to load academic sessions.");
      }

      const data = await response.json();
      setSessions(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load academic sessions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    const role = localStorage.getItem("user_role");

    if (role !== "admin") {
      router.push("/dashboard");
      return;
    }

    fetchSessions();
  }, [router, token]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return sessions;
    }

    return sessions.filter((session) =>
      session.name.toLowerCase().includes(query)
    );
  }, [sessions, search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingSession(null);
  };

  const openEdit = async (session: AcademicSession) => {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_BASE}/academic-sessions/${session.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load session details.");
      }

      const data: AcademicSession = await response.json();

      setEditingSession(data);
      setForm({
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        is_active: data.is_active,
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load session details."
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Session name is required.");
      return;
    }

    if (!form.start_date || !form.end_date) {
      setError("Start date and end date are required.");
      return;
    }

    if (form.end_date <= form.start_date) {
      setError("End date must be after start date.");
      return;
    }

    try {
      setSaving(true);

      const url = editingSession
        ? `${API_BASE}/academic-sessions/${editingSession.id}`
        : `${API_BASE}/academic-sessions/`;

      const method = editingSession ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          start_date: form.start_date,
          end_date: form.end_date,
          is_active: form.is_active,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to save academic session."
        );
      }

      if (editingSession) {
        setSuccess("Academic session updated successfully.");
      } else {
        setSuccess("Academic session created successfully.");
      }

      resetForm();
      await fetchSessions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save academic session."
      );
    } finally {
      setSaving(false);
    }
  };

  const activateSession = async (sessionId: number) => {
    try {
      setActionId(sessionId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_BASE}/academic-sessions/${sessionId}/activate`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to activate session.");
      }

      setSuccess("Academic session activated successfully.");
      await fetchSessions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to activate session."
      );
    } finally {
      setActionId(null);
    }
  };

  const deactivateSession = async (sessionId: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this academic session?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionId(sessionId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_BASE}/academic-sessions/${sessionId}/deactivate`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to deactivate session.");
      }

      setSuccess("Academic session deactivated successfully.");
      await fetchSessions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to deactivate session."
      );
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-full bg-[#f5f7fb]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              School Configuration
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              Academic Sessions
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage school academic years and keep one active session for
              current school operations.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Session
              </p>
              <p className="text-sm font-bold text-[#102A56]">
                {sessions.find((session) => session.is_active)?.name ||
                  "Not configured"}
              </p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="font-bold text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span>{success}</span>
            <button
              onClick={() => setSuccess("")}
              className="font-bold text-emerald-500 hover:text-emerald-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Create / Edit */}
        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#102A56]">
                  {editingSession
                    ? "Edit Academic Session"
                    : "Create Academic Session"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Example: 2026-27 running from April 2026 to March 2027.
                </p>
              </div>

              {editingSession && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4"
          >
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                Session Name
              </label>

              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="2026-27"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                Start Date
              </label>

              <input
                type="date"
                value={form.start_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    start_date: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                End Date
              </label>

              <input
                type="date"
                value={form.end_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    end_date: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div className="flex flex-col justify-end gap-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span className="text-xs font-semibold text-slate-700">
                  Make active
                </span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#102A56] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-900/10 transition hover:bg-[#173b78] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingSession
                    ? "Update Session"
                    : "Create Session"}
              </button>
            </div>
          </form>
        </section>

        {/* List */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#102A56]">
                All Academic Sessions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {sessions.length} session
                {sessions.length === 1 ? "" : "s"} configured.
              </p>
            </div>

            <div className="relative w-full lg:w-72">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search session..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 p-5 sm:p-6">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                ◫
              </div>

              <h3 className="font-bold text-[#102A56]">
                No academic sessions found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Create your first academic session to get started.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Session
                      </th>

                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Start
                      </th>

                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        End
                      </th>

                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSessions.map((session) => (
                      <tr
                        key={session.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-[#102A56]">
                              {session.name.slice(0, 2)}
                            </div>

                            <div>
                              <p className="font-bold text-[#102A56]">
                                {session.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                Session #{session.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-600">
                          {formatDate(session.start_date)}
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-600">
                          {formatDate(session.end_date)}
                        </td>

                        <td className="px-6 py-5">
                          {session.is_active ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(session)}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            {session.is_active ? (
                              <button
                                onClick={() => deactivateSession(session.id)}
                                disabled={actionId === session.id}
                                className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                              >
                                {actionId === session.id
                                  ? "..."
                                  : "Deactivate"}
                              </button>
                            ) : (
                              <button
                                onClick={() => activateSession(session.id)}
                                disabled={actionId === session.id}
                                className="rounded-xl bg-[#102A56] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#173b78] disabled:opacity-50"
                              >
                                {actionId === session.id
                                  ? "..."
                                  : "Activate"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet */}
              <div className="grid gap-4 p-5 lg:hidden">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-[#102A56]">
                          {session.name.slice(0, 2)}
                        </div>

                        <div>
                          <p className="font-bold text-[#102A56]">
                            {session.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            Session #{session.id}
                          </p>
                        </div>
                      </div>

                      {session.is_active ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Start
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {formatDate(session.start_date)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          End
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {formatDate(session.end_date)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => openEdit(session)}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      {session.is_active ? (
                        <button
                          onClick={() => deactivateSession(session.id)}
                          disabled={actionId === session.id}
                          className="flex-1 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {actionId === session.id
                            ? "..."
                            : "Deactivate"}
                        </button>
                      ) : (
                        <button
                          onClick={() => activateSession(session.id)}
                          disabled={actionId === session.id}
                          className="flex-1 rounded-xl bg-[#102A56] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#173b78] disabled:opacity-50"
                        >
                          {actionId === session.id
                            ? "..."
                            : "Activate"}
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
    </div>
  );
}