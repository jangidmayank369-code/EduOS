"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type PreviewRow = {
  row_number?: number;
  admission_number?: string;
  first_name?: string;
  last_name?: string;
  parent_first_name?: string;
  parent_last_name?: string;
  parent_phone?: string;
  parent_email?: string;
  academic_session_id?: string | number;
  class_id?: string | number;
  errors?: string[];
  warnings?: string[];
  valid?: boolean;
};

type ValidationError = {
  row_number?: number;
  errors?: string[];
  data?: Record<string, string>;
};

type PreviewResponse = {
  import_job_id: number;
  module?: string;
  file_name?: string;
  total_rows: number;
  valid_rows?: number;
  successful_rows?: number;
  failed_rows: number;
  can_import: boolean;
  unknown_columns?: string[];
  errors?: ValidationError[];
  rows?: PreviewRow[];
  preview?: PreviewRow[];
};

type ConfirmResponse = {
  message?: string;
  import_job_id?: number;
  total_rows?: number;
  successful_rows?: number;
  failed_rows?: number;
  parent_invitations?: Array<{
    student_admission_number?: string;
    parent_email?: string;
    invitation_token?: string;
  }>;
};

export default function MasterStudent360ImportPage() {
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ConfirmResponse | null>(null);

  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getToken = () => localStorage.getItem("access_token");

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const getApiError = (data: unknown, fallback: string) => {
    if (typeof data !== "object" || data === null) return fallback;

    const body = data as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;

    if (typeof body.detail === "object" && body.detail !== null) {
      const detail = body.detail as {
        missing_columns?: unknown;
        allowed_columns?: unknown;
        message?: unknown;
      };
      const parts: string[] = [];

      if (Array.isArray(detail.missing_columns) && detail.missing_columns.length) {
        parts.push(`Missing required columns: ${detail.missing_columns.join(", ")}`);
      }

      if (Array.isArray(detail.allowed_columns) && detail.allowed_columns.length) {
        parts.push(`Allowed columns: ${detail.allowed_columns.join(", ")}`);
      }

      if (parts.length) return parts.join(" · ");
      if (typeof detail.message === "string") return detail.message;
    }

    return fallback;
  };

  const apiFetch = async (
    path: string,
    options: RequestInit = {},
  ): Promise<Response> => {
    const token = getToken();

    if (!token) {
      handleUnauthorized();
      throw new Error("Authentication required");
    }

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  };

  const selectFile = (file: File | null) => {
    setError("");
    setSuccess("");
    setPreview(null);
    setResult(null);

    if (!file) return;

    const extension = file.name.toLowerCase().split(".").pop();

    if (extension !== "csv") {
      setError("Only CSV files are supported for Master Student Import.");
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    selectFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0] || null;
    selectFile(file);
  };

  const downloadTemplate = async () => {
    try {
      setError("");
      setSuccess("");

      const response = await apiFetch("/students/bulk-import/template");

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(getApiError(data, "Failed to download master template."));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "student_master_import_template.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);

      setSuccess("Master Student 360 template downloaded.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to download master template.",
      );
    }
  };

  const previewImport = async () => {
    if (!selectedFile) {
      setError("Please select a CSV file first.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");
      setPreview(null);
      setResult(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await apiFetch("/students/bulk-import/preview", {
        method: "POST",
        body: formData,
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getApiError(data, "Failed to validate import file."));
      }

      setPreview(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to validate import file.",
      );
    } finally {
      setUploading(false);
    }
  };

  const confirmImport = async () => {
    if (!preview?.import_job_id || !preview.can_import) {
      return;
    }

    const confirmed = window.confirm(
      `Import ${preview.total_rows} student record(s) with their related parent/enrollment data? This will create the records in EduOS.`,
    );

    if (!confirmed) return;

    try {
      setConfirming(true);
      setError("");
      setSuccess("");

      const response = await apiFetch("/students/bulk-import/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          import_job_id: preview.import_job_id,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getApiError(data, "Failed to complete import."));
      }

      setResult(data);
      setPreview(null);
      setSelectedFile(null);
      setSuccess("Master Student 360 import completed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to complete import.",
      );
    } finally {
      setConfirming(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setSuccess("");
  };

  const previewRows = preview?.rows || preview?.preview || [];

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-[1450px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              <Link
                href="/dashboard/students"
                className="hover:text-blue-800"
              >
                Students
              </Link>

              <span className="text-slate-300">/</span>

              <span>Master Import</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
              Student 360 Master Import
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Onboard students in bulk with their related parent/guardian,
              enrollment and admission information from one validated file.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={downloadTemplate}
              className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              ↓ Download Master Template
            </button>

            <Link
              href="/dashboard/students"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              ← Students
            </Link>
          </div>
        </div>

        {/* Success */}
        {success && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
              ✓
            </span>
            {success}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100">
              !
            </span>

            <div className="flex-1 leading-6">{error}</div>

            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Workflow */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["01", "Prepare", "Download the master template"],
              ["02", "Upload", "Upload your completed CSV"],
              ["03", "Validate", "Review every row before import"],
              ["04", "Complete", "Create the Student 360 records"],
            ].map(([number, title, description], index) => (
              <div
                key={number}
                className={`relative rounded-xl p-4 ${
                  index === 0
                    ? "bg-blue-50"
                    : "bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#102A56] text-[10px] font-bold text-white">
                    {number}
                  </span>

                  <p className="text-sm font-bold text-[#102A56]">
                    {title}
                  </p>
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* What this import handles */}
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: "♙",
              title: "Student Profile",
              text: "Admission number, name, DOB, gender, contact and address.",
            },
            {
              icon: "◉",
              title: "Parent / Guardian",
              text: "Parent identity, phone, email, relation and notification settings.",
            },
            {
              icon: "▣",
              title: "Enrollment",
              text: "Academic session, class, roll number and enrollment information.",
            },
            {
              icon: "✓",
              title: "Admission Link",
              text: "Optional linkage with an existing admission application.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">
                {item.icon}
              </div>

              <h3 className="mt-4 text-sm font-bold text-[#102A56]">
                {item.title}
              </h3>

              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* Main upload area */}
        {!preview && !result && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#102A56]">
                    Upload Master Student File
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Use the downloaded template. The file is validated before
                    any data is created.
                  </p>
                </div>

                <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                  CSV · Max 5000 rows
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={handleDrop}
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-12 ${
                  dragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-slate-50/70 hover:border-blue-300 hover:bg-blue-50/30"
                }`}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                  ⇧
                </div>

                <h3 className="mt-5 text-base font-bold text-[#102A56]">
                  Drop your Master CSV here
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  or choose a CSV file from your computer
                </p>

                <label className="mt-5 inline-flex cursor-pointer items-center rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#17386f]">
                  Choose CSV File
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>

                <p className="mt-4 text-[11px] text-slate-400">
                  Only CSV files are accepted. Do not upload passwords or
                  sensitive authentication data.
                </p>
              </div>

              {selectedFile && (
                <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg">
                      📄
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#102A56]">
                        {selectedFile.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={clearFile}
                      className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-blue-100"
                    >
                      Remove
                    </button>

                    <button
                      onClick={previewImport}
                      disabled={uploading}
                      className="rounded-lg bg-[#102A56] px-4 py-2 text-xs font-semibold text-white hover:bg-[#17386f] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploading ? "Validating..." : "Validate & Preview"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                    Validation Complete
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#102A56]">
                    Review Before Import
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {preview.file_name || selectedFile?.name || "Uploaded CSV"}
                  </p>
                </div>

                <div
                  className={`rounded-xl px-4 py-3 text-center ${
                    preview.can_import
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide">
                    Import Status
                  </p>

                  <p className="mt-1 text-sm font-bold">
                    {preview.can_import
                      ? "Ready to Import"
                      : "Fix Validation Errors"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <SummaryCard
                  label="Total Rows"
                  value={preview.total_rows}
                  className="bg-slate-50"
                />

                <SummaryCard
                  label="Valid Rows"
                  value={
                    preview.valid_rows ??
                    preview.successful_rows ??
                    Math.max(
                      preview.total_rows - preview.failed_rows,
                      0,
                    )
                  }
                  className="bg-emerald-50"
                />

                <SummaryCard
                  label="Failed Rows"
                  value={preview.failed_rows}
                  className="bg-red-50"
                />

                <SummaryCard
                  label="Can Import"
                  value={preview.can_import ? "YES" : "NO"}
                  className={
                    preview.can_import
                      ? "bg-blue-50"
                      : "bg-amber-50"
                  }
                />
              </div>
            </div>

            {/* Errors */}
            {preview.errors && preview.errors.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-white shadow-sm">
                <div className="border-b border-red-100 bg-red-50 px-5 py-4 sm:px-6">
                  <h3 className="text-sm font-bold text-red-800">
                    Validation Errors
                  </h3>
                  <p className="mt-1 text-xs text-red-600">
                    Fix these issues in the CSV and upload the file again.
                    Nothing will be imported while validation errors exist.
                  </p>
                </div>

                <div className="max-h-[420px] overflow-auto p-4">
                  <div className="space-y-2">
                    {preview.errors.map((item, index) => (
                      <div
                        key={`${item.row_number ?? "row"}-${index}`}
                        className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start gap-3 text-xs">
                          {item.row_number !== undefined && (
                            <span className="rounded-full bg-red-100 px-2.5 py-1 font-bold text-red-700">
                              Row {item.row_number}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            {(item.errors || []).map((message, errorIndex) => (
                              <p
                                key={errorIndex}
                                className="leading-5 text-slate-700"
                              >
                                {message}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {preview.unknown_columns && preview.unknown_columns.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <p className="text-sm font-bold text-amber-800">
                  Unsupported CSV columns detected
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-700">
                  These columns are ignored by the backend. Remove them and
                  download the official template if you want a clean import.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {preview.unknown_columns.map((column) => (
                    <code
                      key={column}
                      className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200"
                    >
                      {column}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Row preview */}
            {previewRows.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <h3 className="text-sm font-bold text-[#102A56]">
                      Student 360 Preview
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Review student, parent and enrollment information before
                      confirming.
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-slate-400">
                    Showing {Math.min(previewRows.length, 100)} preview rows
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px]">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Row
                        </th>

                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Student
                        </th>

                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Admission
                        </th>

                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Parent / Guardian
                        </th>

                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Parent Contact
                        </th>

                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Session
                        </th>

                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Class
                        </th>

                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {previewRows.slice(0, 100).map((row, index) => {
                        const valid =
                          row.valid !== false &&
                          (!row.errors || row.errors.length === 0);

                        return (
                          <tr
                            key={`${row.row_number || index}-${row.admission_number || index}`}
                            className="hover:bg-slate-50"
                          >
                            <td className="px-4 py-4 text-xs font-bold text-slate-400">
                              {row.row_number || index + 2}
                            </td>

                            <td className="px-4 py-4">
                              <p className="text-sm font-semibold text-[#102A56]">
                                {row.first_name || "—"}{" "}
                                {row.last_name || ""}
                              </p>
                            </td>

                            <td className="px-4 py-4 text-xs font-medium text-slate-600">
                              {row.admission_number || "—"}
                            </td>

                            <td className="px-4 py-4 text-xs text-slate-600">
                              {row.parent_first_name ||
                              row.parent_last_name
                                ? `${row.parent_first_name || ""} ${
                                    row.parent_last_name || ""
                                  }`
                                : "—"}
                            </td>

                            <td className="px-4 py-4 text-xs text-slate-500">
                              <div>{row.parent_phone || "—"}</div>
                              {row.parent_email && (
                                <div className="mt-1 max-w-[220px] truncate">
                                  {row.parent_email}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-4 text-xs text-slate-600">
                              {row.academic_session_id || "—"}
                            </td>

                            <td className="px-4 py-4 text-xs text-slate-600">
                              {row.class_id || "—"}
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                                  valid
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {valid ? "Valid" : "Error"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:justify-between sm:p-6">
              <button
                onClick={clearFile}
                disabled={confirming}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ← Upload Different File
              </button>

              <button
                onClick={confirmImport}
                disabled={!preview.can_import || confirming}
                className="rounded-xl bg-[#102A56] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#17386f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {confirming
                  ? "Importing Student 360..."
                  : `Confirm Import · ${preview.total_rows} Rows`}
              </button>
            </div>
          </div>
        )}

        {/* Completion */}
        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-emerald-50 p-6 text-center sm:p-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl text-emerald-600 shadow-sm">
                ✓
              </div>

              <h2 className="mt-5 text-2xl font-bold text-[#102A56]">
                Student 360 Import Completed
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                The validated student records and their supported related
                records have been created successfully.
              </p>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
              <SummaryCard
                label="Total Rows"
                value={result.total_rows ?? 0}
                className="bg-slate-50"
              />

              <SummaryCard
                label="Imported"
                value={result.successful_rows ?? 0}
                className="bg-emerald-50"
              />

              <SummaryCard
                label="Failed"
                value={result.failed_rows ?? 0}
                className="bg-red-50"
              />
            </div>

            {Array.isArray(result.parent_invitations) &&
              result.parent_invitations.length > 0 && (
                <div className="mx-5 mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 sm:mx-6 sm:mb-6">
                  <strong>{result.parent_invitations.length}</strong> parent
                  invitation(s) were created for newly onboarded parent
                  accounts.
                </div>
              )}

            {Array.isArray(result.parent_invitations) &&
              result.parent_invitations.length > 0 && (
                <div className="mx-5 mb-5 overflow-hidden rounded-xl border border-slate-200 sm:mx-6">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#102A56]">
                      Parent Invitations
                    </h3>
                  </div>
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full min-w-[520px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-left">
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Student
                          </th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Parent Email
                          </th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Invitation Token
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.parent_invitations.map((invitation, index) => (
                          <tr key={`${invitation.parent_email ?? "parent"}-${index}`}>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                              {invitation.student_admission_number || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {invitation.parent_email || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <code className="break-all text-[10px] text-slate-500">
                                {invitation.invitation_token || "—"}
                              </code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            <div className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-center sm:p-6">
              <Link
                href="/dashboard/students"
                className="rounded-xl bg-[#102A56] px-6 py-3 text-center text-sm font-semibold text-white hover:bg-[#17386f]"
              >
                View Students
              </Link>

              <button
                onClick={() => {
                  setResult(null);
                  setSelectedFile(null);
                  setSuccess("");
                  setError("");
                }}
                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}

        {/* Column groups */}
        {!preview && !result && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-[#102A56]">
                Master Template Structure
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                One row represents one complete Student 360 onboarding
                record. Use only fields supported by the downloaded template.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ColumnGroup
                number="01"
                title="Student"
                fields={[
                  "admission_number",
                  "first_name",
                  "last_name",
                  "date_of_birth",
                  "gender",
                  "email",
                  "phone",
                  "address",
                ]}
              />

              <ColumnGroup
                number="02"
                title="Enrollment"
                fields={[
                  "academic_session_id",
                  "class_id",
                  "roll_number",
                  "enrollment_date",
                  "enrollment_status",
                ]}
              />

              <ColumnGroup
                number="03"
                title="Parent / Guardian"
                fields={[
                  "parent_first_name",
                  "parent_last_name",
                  "parent_phone",
                  "parent_email",
                  "parent_relation",
                  "parent_is_primary",
                  "parent_is_emergency_contact",
                  "parent_receives_notifications",
                ]}
              />

              <ColumnGroup
                number="04"
                title="Admission Linkage"
                fields={[
                  "admission_application_id",
                  "admission_application_number",
                ]}
              />
            </div>

            <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
              <strong>Important:</strong> The template downloaded from EduOS
              is the source of truth for supported columns. Do not manually
              add unsupported fields.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`rounded-xl p-4 ${className || "bg-slate-50"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold text-[#102A56]">{value}</p>
    </div>
  );
}

function ColumnGroup({
  number,
  title,
  fields,
}: {
  number: string;
  title: string;
  fields: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#102A56] text-[10px] font-bold text-white">
          {number}
        </span>

        <h3 className="text-sm font-bold text-[#102A56]">{title}</h3>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {fields.map((field) => (
          <code
            key={field}
            className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100"
          >
            {field}
          </code>
        ))}
      </div>
    </div>
  );
}