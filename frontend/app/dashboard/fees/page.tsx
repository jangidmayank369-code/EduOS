"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://127.0.0.1:8000";

type Student = {
  id: number;
  admission_number?: string;
  first_name: string;
  last_name: string;
  class_id?: number | null;
};

type Fee = {
  id: number;
  student_id: number;
  title: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  created_at?: string;
  updated_at?: string;
};

type ClassItem = {
  id: number;
  name: string;
};

export default function FeesPage() {
  const router = useRouter();

  const [fees, setFees] = useState<Fee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);

  const [createForm, setCreateForm] = useState({
    student_id: "",
    title: "",
    amount_due: "",
  });

  const [editForm, setEditForm] = useState({
    title: "",
    amount_due: "",
    amount_paid: "",
    status: "",
  });

  const getToken = () => {
    return localStorage.getItem("access_token");
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const apiRequest = async (
    endpoint: string,
    options: RequestInit = {}
  ) => {
    const token = getToken();

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Unauthorized");
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.detail || "Something went wrong. Please try again."
      );
    }

    return data;
  };

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const role = localStorage.getItem("user_role");

      if (role === "parent") {
        setError(
          "Parent fee view requires selecting a child. Use the parent dashboard to open a child's fees."
        );
        setLoading(false);
        return;
      }

      const [feesData, studentsData, classesData] = await Promise.all([
        apiRequest("/fees/"),
        apiRequest("/students/"),
        apiRequest("/classes/"),
      ]);

      setFees(Array.isArray(feesData) ? feesData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setClasses(Array.isArray(classesData) ? classesData : []);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const studentMap = useMemo(() => {
    const map: Record<number, Student> = {};

    students.forEach((student) => {
      map[student.id] = student;
    });

    return map;
  }, [students]);

  const classMap = useMemo(() => {
    const map: Record<number, string> = {};

    classes.forEach((item) => {
      map[item.id] = item.name;
    });

    return map;
  }, [classes]);

  const filteredFees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return fees.filter((fee) => {
      const student = studentMap[fee.student_id];

      const studentName = student
        ? `${student.first_name} ${student.last_name}`.toLowerCase()
        : "";

      const admissionNumber =
        student?.admission_number?.toLowerCase() || "";

      const matchesSearch =
        !query ||
        fee.title.toLowerCase().includes(query) ||
        studentName.includes(query) ||
        admissionNumber.includes(query) ||
        String(fee.student_id).includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        fee.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [fees, search, statusFilter, studentMap]);

  const totals = useMemo(() => {
    return fees.reduce(
      (acc, fee) => {
        acc.due += Number(fee.amount_due || 0);
        acc.paid += Number(fee.amount_paid || 0);

        if (fee.status === "pending") {
          acc.pending += 1;
        }

        if (fee.status === "partial") {
          acc.partial += 1;
        }

        if (fee.status === "paid") {
          acc.paidCount += 1;
        }

        return acc;
      },
      {
        due: 0,
        paid: 0,
        pending: 0,
        partial: 0,
        paidCount: 0,
      }
    );
  }, [fees]);

  const totalBalance = Math.max(totals.due - totals.paid, 0);

  const resetCreateForm = () => {
    setCreateForm({
      student_id: "",
      title: "",
      amount_due: "",
    });
  };

  const openCreateModal = () => {
    setError("");
    setSuccess("");
    resetCreateForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (!saving) {
      setShowCreateModal(false);
      resetCreateForm();
    }
  };

  const handleCreateFee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.student_id) {
      setError("Please select a student.");
      return;
    }

    if (!createForm.title.trim()) {
      setError("Please enter a fee title.");
      return;
    }

    const amountDue = Number(createForm.amount_due);

    if (!amountDue || amountDue <= 0) {
      setError("Amount due must be greater than 0.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/fees/", {
        method: "POST",
        body: JSON.stringify({
          student_id: Number(createForm.student_id),
          title: createForm.title.trim(),
          amount_due: amountDue,
        }),
      });

      setSuccess("Fee created successfully.");
      setShowCreateModal(false);
      resetCreateForm();

      await loadData();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (fee: Fee) => {
    setError("");
    setSuccess("");

    setEditingFee(fee);

    setEditForm({
      title: fee.title,
      amount_due: String(fee.amount_due),
      amount_paid: String(fee.amount_paid),
      status: fee.status,
    });
  };

  const closeEditModal = () => {
    if (!saving) {
      setEditingFee(null);
    }
  };

  const handleUpdateFee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingFee) {
      return;
    }

    if (!editForm.title.trim()) {
      setError("Please enter a fee title.");
      return;
    }

    const amountDue = Number(editForm.amount_due);
    const amountPaid = Number(editForm.amount_paid);

    if (!amountDue || amountDue <= 0) {
      setError("Amount due must be greater than 0.");
      return;
    }

    if (amountPaid < 0) {
      setError("Amount paid cannot be negative.");
      return;
    }

    if (amountPaid > amountDue) {
      setError("Amount paid cannot exceed amount due.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(`/fees/${editingFee.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editForm.title.trim(),
          amount_due: amountDue,
          amount_paid: amountPaid,
          status: editForm.status,
        }),
      });

      setSuccess("Fee updated successfully.");
      setEditingFee(null);

      await loadData();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const getStudentName = (studentId: number) => {
    const student = studentMap[studentId];

    if (!student) {
      return `Student #${studentId}`;
    }

    return `${student.first_name} ${student.last_name}`;
  };

  const getClassName = (studentId: number) => {
    const student = studentMap[studentId];

    if (!student?.class_id) {
      return "Not assigned";
    }

    return classMap[student.class_id] || `Class #${student.class_id}`;
  };

  const getBalance = (fee: Fee) => {
    return Math.max(
      Number(fee.amount_due || 0) - Number(fee.amount_paid || 0),
      0
    );
  };

  const getStatusClasses = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";

      case "partial":
        return "bg-amber-50 text-amber-700 border-amber-100";

      case "cancelled":
        return "bg-red-50 text-red-700 border-red-100";

      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#102A56]" />
          <p className="text-sm font-medium text-slate-500">
            Loading fees...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span>Finance</span>
            <span>/</span>
            <span className="text-[#102A56]">Fees</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
            Fees Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create, track and update student fee records.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#0b2146]"
        >
          <span className="text-lg leading-none">+</span>
          Create Fee
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1">{error}</p>
          </div>

          <button
            onClick={() => setError("")}
            className="font-bold text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{success}</span>

          <button
            onClick={() => setSuccess("")}
            className="font-bold text-emerald-500 hover:text-emerald-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Due
              </p>
              <p className="mt-2 text-2xl font-bold text-[#102A56]">
                {formatCurrency(totals.due)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-lg text-[#102A56]">
              ₹
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Paid
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {formatCurrency(totals.paid)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">
              ✓
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Outstanding
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-600">
                {formatCurrency(totalBalance)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-lg text-amber-600">
              !
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Fee Records
              </p>
              <p className="mt-2 text-2xl font-bold text-[#102A56]">
                {fees.length}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-[#102A56]">
              #
            </div>
          </div>

          <div className="mt-3 flex gap-3 text-xs text-slate-500">
            <span>{totals.pending} pending</span>
            <span>{totals.partial} partial</span>
            <span>{totals.paidCount} paid</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              ⌕
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student, admission number or fee title..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Student
                </th>
                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Fee
                </th>
                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Class
                </th>
                <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Due
                </th>
                <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Paid
                </th>
                <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Balance
                </th>
                <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredFees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                        ₹
                      </div>
                      <h3 className="font-semibold text-slate-700">
                        No fee records found
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Try changing your search/filter or create a new fee.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFees.map((fee) => {
                  const student = studentMap[fee.student_id];

                  return (
                    <tr
                      key={fee.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#102A56] text-sm font-bold text-white">
                            {getStudentName(fee.student_id)
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-700">
                              {getStudentName(fee.student_id)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {student?.admission_number ||
                                `Student #${fee.student_id}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-700">
                          {fee.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          Fee ID #{fee.id}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {getClassName(fee.student_id)}
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-slate-700">
                        {formatCurrency(fee.amount_due)}
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-emerald-600">
                        {formatCurrency(fee.amount_paid)}
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-amber-600">
                        {formatCurrency(getBalance(fee))}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                            fee.status
                          )}`}
                        >
                          {fee.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => openEditModal(fee)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#102A56] transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {filteredFees.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
              ₹
            </div>
            <h3 className="font-semibold text-slate-700">
              No fee records found
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Try changing your filters.
            </p>
          </div>
        ) : (
          filteredFees.map((fee) => (
            <div
              key={fee.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102A56] text-sm font-bold text-white">
                    {getStudentName(fee.student_id)
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div>
                    <p className="font-semibold text-slate-700">
                      {getStudentName(fee.student_id)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {getClassName(fee.student_id)}
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${getStatusClasses(
                    fee.status
                  )}`}
                >
                  {fee.status}
                </span>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {fee.title}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] text-slate-400">Due</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {formatCurrency(fee.amount_due)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-400">Paid</p>
                    <p className="mt-1 text-sm font-bold text-emerald-600">
                      {formatCurrency(fee.amount_paid)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-400">Balance</p>
                    <p className="mt-1 text-sm font-bold text-amber-600">
                      {formatCurrency(getBalance(fee))}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openEditModal(fee)}
                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-[#102A56] transition hover:bg-blue-50"
              >
                Edit Fee
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-[#102A56]">
                  Create Fee
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Add a new fee record for a student.
                </p>
              </div>

              <button
                onClick={closeCreateModal}
                className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateFee} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Student
                </label>

                <select
                  value={createForm.student_id}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      student_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="">Select student</option>

                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                      {student.admission_number
                        ? ` — ${student.admission_number}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Fee Title
                </label>

                <input
                  type="text"
                  value={createForm.title}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Tuition Fee - September"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Amount Due
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={createForm.amount_due}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        amount_due: event.target.value,
                      }))
                    }
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  New fees are created with amount paid = ₹0 and status =
                  pending.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#102A56] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0b2146] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Create Fee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-[#102A56]">
                  Update Fee
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {getStudentName(editingFee.student_id)} · Fee #
                  {editingFee.id}
                </p>
              </div>

              <button
                onClick={closeEditModal}
                className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateFee} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Fee Title
                </label>

                <input
                  type="text"
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Amount Due
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      ₹
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={editForm.amount_due}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          amount_due: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Amount Paid
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      ₹
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.amount_paid}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          amount_paid: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Status
                </label>

                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                >
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <p className="mt-2 text-xs text-slate-400">
                  The backend automatically derives status when amount paid
                  changes. Status can also be supplied directly.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Current balance</span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(
                      Math.max(
                        Number(editForm.amount_due || 0) -
                          Number(editForm.amount_paid || 0),
                        0
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#102A56] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0b2146] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}