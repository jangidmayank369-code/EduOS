"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ChangeItem = {
  field: string;
  old: string | number | null;
  new: string | number | null;
};

type PreviewRow = {
  row_number: number;
  student_id: number;
  admission_number: string;
  student_name: string;
  updates: Record<string, unknown>;
  changes: ChangeItem[];
};

type ValidationError = {
  row_number: number;
  admission_number?: string;
  errors: string[];
  data?: Record<string, string>;
};

type PreviewResponse = {
  module: string;
  file_name: string;
  import_job_id: number;
  total_rows: number;
  valid_rows: number;
  failed_rows: number;
  can_update: boolean;
  unknown_columns: string[];
  errors: ValidationError[];
  preview: PreviewRow[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function StudentBulkUpdatePage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getToken = () => localStorage.getItem("access_token");

  const unauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const getErrorMessage = (data: unknown, fallback: string) => {
    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data
    ) {
      const detail = (data as { detail?: unknown }).detail;

      if (typeof detail === "string") return detail;

      if (
        typeof detail === "object" &&
        detail !== null &&
        "message" in detail
      ) {
        const message = (detail as { message?: unknown }).message;
        if (typeof message === "string") return message;
      }
    }

    return fallback;
  };

  const authenticatedFetch = async (
    url: string,
    options: RequestInit = {},
  ) => {
    const token = getToken();

    if (!token) {
      unauthorized();
      throw new Error("Authentication required");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      unauthorized();
      throw new Error("Session expired");
    }

    return response;
  };

  const downloadTemplate = async () => {
    try {
      setError("");
      setSuccess("");

      const response = await authenticatedFetch(
        `${API_BASE}/students/bulk-update/template`,
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          getErrorMessage(data, "Failed to download template"),
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "student_bulk_update_template.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to download template",
      );
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setError("");
    setSuccess("");
  };

  const previewFile = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await authenticatedFetch(
        `${API_BASE}/students/bulk-update/preview`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to preview bulk update"),
        );
      }

      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to preview bulk update",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmUpdate = async () => {
    if (!preview?.can_update) {
      setError("Fix all validation errors before confirming.");
      return;
    }

    const accepted = window.confirm(
      `Update ${preview.valid_rows} students? This operation is atomic.`,
    );

    if (!accepted) return;

    try {
      setConfirming(true);
      setError("");
      setSuccess("");

      const response = await authenticatedFetch(
        `${API_BASE}/students/bulk-update/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            import_job_id: preview.import_job_id,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to confirm bulk update"),
        );
      }

      setSuccess(
        `${data.updated_rows} student records updated successfully.`,
      );
      setFile(null);
      setPreview(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to confirm bulk update",
      );
    } finally {
      setConfirming(false);
    }
  };

  const showValue = (value: string | number | null) => {
    if (value === null || value === "") return "—";
    return String(value);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <button
              onClick={() => router.push("/dashboard/students")}
              className="mb-3 text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Students
            </button>

            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Student Operations
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              Student Bulk Update
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Match existing students by admission number, validate every row,
              preview old → new values, then update all rows atomically.
            </p>
          </div>

          <button
            onClick={downloadTemplate}
            className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            ↓ Download Template
          </button>
        </div>

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            ✓ {success}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <span>! {error}</span>
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            ["1", "Download", "Use the official CSV template."],
            ["2", "Upload", "Keep admission_number unchanged."],
            ["3", "Preview", "Review validation and old → new values."],
            ["4", "Confirm", "All valid rows update in one transaction."],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#102A56] text-sm font-bold text-white">
                {number}
              </div>
              <p className="mt-3 font-bold text-[#102A56]">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-bold text-[#102A56]">
                Update CSV
              </label>

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#102A56] file:px-4 file:py-2 file:text-xs file:font-bold file:text-white"
              />

              <p className="mt-2 text-xs text-slate-400">
                Maximum 5,000 rows. Blank optional cells mean “do not update
                this field”.
              </p>
            </div>

            <button
              onClick={previewFile}
              disabled={!file || loading}
              className="rounded-xl bg-[#102A56] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Validating..." : "Validate & Preview"}
            </button>
          </div>
        </div>

        {preview && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Total Rows", preview.total_rows],
                ["Valid", preview.valid_rows],
                ["Errors", preview.failed_rows],
                ["Job ID", preview.import_job_id],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#102A56]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {preview.unknown_columns.length > 0 && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Unknown columns ignored:{" "}
                <strong>{preview.unknown_columns.join(", ")}</strong>
              </div>
            )}

            {preview.errors.length > 0 && (
              <div className="mb-6 overflow-hidden rounded-2xl border border-red-200 bg-white">
                <div className="border-b border-red-100 bg-red-50 px-5 py-4">
                  <h2 className="font-bold text-red-700">
                    Validation Errors
                  </h2>
                  <p className="mt-1 text-xs text-red-500">
                    Nothing will be updated until every row is valid.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {preview.errors.map((item) => (
                    <div key={item.row_number} className="p-4">
                      <div className="font-semibold text-slate-700">
                        Row {item.row_number}
                        {item.admission_number
                          ? ` · ${item.admission_number}`
                          : ""}
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-600">
                        {item.errors.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.preview.length > 0 && (
              <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-[#102A56]">
                    Change Preview
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Only changed values are shown.
                  </p>
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-400">
                          Row
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-400">
                          Student
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-400">
                          Changes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.preview.map((row) => (
                        <tr key={row.row_number}>
                          <td className="px-5 py-4 text-sm text-slate-500">
                            {row.row_number}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-[#102A56]">
                              {row.student_name}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {row.admission_number}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              {row.changes.map((change) => (
                                <div
                                  key={change.field}
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                                >
                                  <span className="font-bold text-slate-600">
                                    {change.field}
                                  </span>
                                  <div className="mt-1">
                                    <span className="text-red-500 line-through">
                                      {showValue(change.old)}
                                    </span>
                                    <span className="mx-2 text-slate-400">
                                      →
                                    </span>
                                    <span className="font-semibold text-emerald-700">
                                      {showValue(change.new)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 lg:hidden">
                  {preview.preview.map((row) => (
                    <div key={row.row_number} className="p-4">
                      <p className="font-bold text-[#102A56]">
                        {row.student_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Row {row.row_number} · {row.admission_number}
                      </p>

                      <div className="mt-3 space-y-2">
                        {row.changes.map((change) => (
                          <div
                            key={change.field}
                            className="rounded-lg bg-slate-50 p-3 text-xs"
                          >
                            <p className="font-bold text-slate-600">
                              {change.field}
                            </p>
                            <p className="mt-1">
                              <span className="text-red-500">
                                {showValue(change.old)}
                              </span>
                              <span className="mx-2">→</span>
                              <span className="font-semibold text-emerald-700">
                                {showValue(change.new)}
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
              <div>
                <p className="font-bold text-[#102A56]">
                  {preview.can_update
                    ? "Ready to update"
                    : "CSV needs corrections"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Confirm is enabled only when every uploaded row is valid.
                </p>
              </div>

              <button
                onClick={confirmUpdate}
                disabled={!preview.can_update || confirming}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {confirming
                  ? "Updating..."
                  : `Confirm ${preview.valid_rows} Updates`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
