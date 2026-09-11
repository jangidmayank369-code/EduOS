"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Student = {
  id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_id?: number | null;
  is_active?: boolean;
};

type SchoolClass = {
  id: number;
  name: string;
};

type Fee = {
  id: number;
  student_id: number;
  fee_structure_id?: number | null;
  academic_session_id?: number | null;
  title: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type Payment = {
  id: number;
  fee_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_reference?: string | null;
  receipt_number: string;
  remarks?: string | null;
  created_at: string;
};

type Receipt = {
  payment_id: number;
  receipt_number: string;
  payment_date: string;

  student_id: number;
  student_name: string;
  admission_number: string;
  class_name: string | null;

  fee_id: number;
  fee_title: string;

  total_amount: number;
  previously_paid: number;
  payment_amount: number;
  total_paid: number;
  remaining_amount: number;

  payment_method: string;
  transaction_reference?: string | null;
  remarks?: string | null;
};

type FeeForm = {
  title: string;
  amount_due: string;
};

type PaymentForm = {
  amount: string;
  payment_method: string;
  transaction_reference: string;
  remarks: string;
};

const API_BASE = "http://127.0.0.1:8000";

const emptyFeeForm: FeeForm = {
  title: "",
  amount_due: "",
};

const emptyPaymentForm: PaymentForm = {
  amount: "",
  payment_method: "UPI",
  transaction_reference: "",
  remarks: "",
};

export default function FeesPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [feeForm, setFeeForm] = useState<FeeForm>(emptyFeeForm);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const [paymentForm, setPaymentForm] =
    useState<PaymentForm>(emptyPaymentForm);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyFee, setHistoryFee] = useState<Fee | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
    "Content-Type": "application/json",
  });

  const handleUnauthorized = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const handleResponseError = async (response: Response) => {
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired");
    }

    let message = "Something went wrong";

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

  const fetchAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [studentsResponse, classesResponse, feesResponse] =
        await Promise.all([
          fetch(`${API_BASE}/students/`, {
            headers: authHeaders(),
          }),
          fetch(`${API_BASE}/classes/`, {
            headers: authHeaders(),
          }),
          fetch(`${API_BASE}/fees/`, {
            headers: authHeaders(),
          }),
        ]);

      if (!studentsResponse.ok) {
        await handleResponseError(studentsResponse);
      }

      if (!classesResponse.ok) {
        await handleResponseError(classesResponse);
      }

      if (!feesResponse.ok) {
        await handleResponseError(feesResponse);
      }

      const studentsData = await studentsResponse.json();
      const classesData = await classesResponse.json();
      const feesData = await feesResponse.json();

      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setFees(Array.isArray(feesData) ? feesData : []);
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(err?.message || "Unable to load fee data");
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

    fetchAll();
  }, []);

  const classMap = useMemo(() => {
    const map = new Map<number, string>();

    classes.forEach((item) => {
      map.set(item.id, item.name);
    });

    return map;
  }, [classes]);

  const studentMap = useMemo(() => {
    const map = new Map<number, Student>();

    students.forEach((student) => {
      map.set(student.id, student);
    });

    return map;
  }, [students]);

  const getStudentName = (studentId: number) => {
    const student = studentMap.get(studentId);

    if (!student) {
      return `Student #${studentId}`;
    }

    return `${student.first_name} ${student.last_name}`.trim();
  };

  const getStudentAdmissionNumber = (studentId: number) => {
    return studentMap.get(studentId)?.admission_number || `#${studentId}`;
  };

  const getStudentClass = (studentId: number) => {
    const student = studentMap.get(studentId);

    if (!student?.class_id) {
      return "Class not assigned";
    }

    return classMap.get(student.class_id) || "Class not found";
  };

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students
      .filter((student) => {
        if (classFilter && String(student.class_id) !== classFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const fullName =
          `${student.first_name} ${student.last_name}`.toLowerCase();

        return (
          fullName.includes(query) ||
          student.admission_number.toLowerCase().includes(query) ||
          String(student.id).includes(query)
        );
      })
      .slice(0, 30);
  }, [students, search, classFilter]);

  const visibleFees = useMemo(() => {
    let result = [...fees];

    if (selectedStudent) {
      result = result.filter(
        (fee) => fee.student_id === selectedStudent.id,
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(
        (fee) => fee.status.toLowerCase() === statusFilter,
      );
    }

    return result;
  }, [fees, selectedStudent, statusFilter]);

  const selectedStudentFees = useMemo(() => {
    if (!selectedStudent) {
      return [];
    }

    return fees.filter(
      (fee) => fee.student_id === selectedStudent.id,
    );
  }, [fees, selectedStudent]);

  const studentOutstanding = useMemo(() => {
    if (!selectedStudent) {
      return 0;
    }

    return selectedStudentFees.reduce(
      (total, fee) =>
        total + Math.max(fee.amount_due - fee.amount_paid, 0),
      0,
    );
  }, [selectedStudent, selectedStudentFees]);

  const totalDue = fees.reduce(
    (total, fee) =>
      total + Math.max(fee.amount_due - fee.amount_paid, 0),
    0,
  );

  const totalCollected = fees.reduce(
    (total, fee) => total + fee.amount_paid,
    0,
  );

  const pendingFees = fees.filter(
    (fee) => fee.status.toLowerCase() === "pending",
  ).length;

  const partialFees = fees.filter(
    (fee) => fee.status.toLowerCase() === "partial",
  ).length;

  const showSuccess = (message: string) => {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3500);
  };

  const openCreateFee = () => {
    if (!selectedStudent) {
      setError("Search and select a student first.");
      return;
    }

    setFeeForm(emptyFeeForm);
    setFeeModalOpen(true);
  };

  const createFee = async () => {
    if (!selectedStudent) {
      setError("Please select a student.");
      return;
    }

    if (!feeForm.title.trim()) {
      setError("Fee title is required.");
      return;
    }

    const amount = Number(feeForm.amount_due);

    if (!amount || amount <= 0) {
      setError("Enter a valid fee amount.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/fees/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          student_id: selectedStudent.id,
          title: feeForm.title.trim(),
          amount_due: amount,
        }),
      });

      if (!response.ok) {
        await handleResponseError(response);
      }

      setFeeModalOpen(false);
      showSuccess("Fee added successfully.");
      await fetchAll();
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(err?.message || "Unable to create fee");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openPayment = (fee: Fee) => {
    const remaining = Math.max(
      fee.amount_due - fee.amount_paid,
      0,
    );

    if (remaining <= 0) {
      setError("This fee is already fully paid.");
      return;
    }

    setSelectedFee(fee);

    setPaymentForm({
      ...emptyPaymentForm,
      amount: String(remaining),
    });

    setPaymentModalOpen(true);
  };

  const createPayment = async () => {
    if (!selectedFee) {
      return;
    }

    const amount = Number(paymentForm.amount);
    const remaining =
      selectedFee.amount_due - selectedFee.amount_paid;

    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (amount > remaining) {
      setError(
        `Maximum payable amount is ₹${remaining.toLocaleString("en-IN")}.`,
      );
      return;
    }

    if (!paymentForm.payment_method.trim()) {
      setError("Payment method is required.");
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/fee-payments/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          fee_id: selectedFee.id,
          amount,
          payment_method: paymentForm.payment_method,
          transaction_reference:
            paymentForm.transaction_reference.trim() || null,
          remarks: paymentForm.remarks.trim() || null,
        }),
      });

      if (!response.ok) {
        await handleResponseError(response);
      }

      const payment: Payment = await response.json();

      setPaymentModalOpen(false);
      showSuccess(
        `Payment recorded. Receipt ${payment.receipt_number}`,
      );

      await fetchAll();

      openReceipt(payment.id);
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(err?.message || "Unable to record payment");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openHistory = async (fee: Fee) => {
    setHistoryFee(fee);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setPayments([]);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/fee-payments/fee/${fee.id}`,
        {
          headers: authHeaders(),
        },
      );

      if (!response.ok) {
        await handleResponseError(response);
      }

      const data = await response.json();

      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(err?.message || "Unable to load payment history");
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const openReceipt = async (paymentId: number) => {
    setReceiptModalOpen(true);
    setReceiptLoading(true);
    setReceipt(null);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/fee-payments/${paymentId}/receipt`,
        {
          headers: authHeaders(),
        },
      );

      if (!response.ok) {
        await handleResponseError(response);
      }

      const data = await response.json();

      setReceipt(data);
    } catch (err: any) {
      if (err?.message !== "Session expired") {
        setError(err?.message || "Unable to load receipt");
      }
    } finally {
      setReceiptLoading(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const clearStudent = () => {
    setSelectedStudent(null);
    setSearch("");
    setStatusFilter("all");
  };

  const formatMoney = (amount: number) =>
    `₹${Number(amount || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const statusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-emerald-50 text-emerald-700";
      case "partial":
        return "bg-amber-50 text-amber-700";
      case "pending":
        return "bg-red-50 text-red-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          .print-receipt,
          .print-receipt * {
            visibility: visible !important;
          }

          .print-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
          }
        }
      `}</style>

      <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Finance
              </p>

              <h1 className="text-2xl font-bold tracking-tight text-[#102A56] sm:text-3xl">
                Fee Collection
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Find a student quickly and collect fees without scrolling
                through dropdowns.
              </p>
            </div>

            <button
              onClick={openCreateFee}
              className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#16396f]"
            >
              + Add Fee
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
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total Collected"
              value={formatMoney(totalCollected)}
              icon="₹"
            />

            <SummaryCard
              label="Outstanding"
              value={formatMoney(totalDue)}
              icon="!"
            />

            <SummaryCard
              label="Pending Fees"
              value={String(pendingFees)}
              icon="◷"
            />

            <SummaryCard
              label="Partial Fees"
              value={String(partialFees)}
              icon="◐"
            />
          </div>

          {/* Student search */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-bold text-[#102A56]">
                  Find Student
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Search by name, admission number or student ID.
                </p>
              </div>

              {selectedStudent && (
                <button
                  onClick={clearStudent}
                  className="w-fit rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Clear Student
                </button>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>

                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);

                    if (selectedStudent) {
                      setSelectedStudent(null);
                    }
                  }}
                  placeholder="Type student name or admission number..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />

                {search.trim() && !selectedStudent && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {filteredStudents.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-400">
                        No student found.
                      </div>
                    ) : (
                      filteredStudents.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => {
                            setSelectedStudent(student);
                            setSearch(
                              `${student.first_name} ${student.last_name}`,
                            );
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-50"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#102A56] text-sm font-bold text-white">
                            {student.first_name?.[0]?.toUpperCase() ||
                              "S"}
                            {student.last_name?.[0]?.toUpperCase() || ""}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {student.first_name} {student.last_name}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {student.admission_number}
                              {" · "}
                              {student.class_id
                                ? classMap.get(student.class_id) ||
                                  "Class"
                                : "Class not assigned"}
                            </p>
                          </div>

                          <span className="text-xs font-semibold text-blue-600">
                            Select
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
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
            </div>

            {/* Selected student */}
            {selectedStudent && (
              <div className="mt-5 rounded-2xl bg-[#102A56] p-4 text-white sm:p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold">
                      {selectedStudent.first_name?.[0]?.toUpperCase()}
                      {selectedStudent.last_name?.[0]?.toUpperCase()}
                    </div>

                    <div>
                      <p className="text-lg font-bold">
                        {selectedStudent.first_name}{" "}
                        {selectedStudent.last_name}
                      </p>

                      <p className="mt-1 text-xs text-blue-100">
                        {selectedStudent.admission_number}
                        {" · "}
                        {getStudentClass(selectedStudent.id)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MiniStat
                      label="Fees"
                      value={String(selectedStudentFees.length)}
                    />

                    <MiniStat
                      label="Outstanding"
                      value={formatMoney(studentOutstanding)}
                    />

                    <button
                      onClick={() => {
                        const firstDue = selectedStudentFees.find(
                          (fee) =>
                            fee.amount_due > fee.amount_paid,
                        );

                        if (firstDue) {
                          openPayment(firstDue);
                        } else {
                          setError(
                            "No outstanding fee found for this student.",
                          );
                        }
                      }}
                      className="col-span-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#102A56] transition hover:bg-blue-50 sm:col-span-1"
                    >
                      Collect Payment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Fee list */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-bold text-[#102A56]">
                  {selectedStudent
                    ? `${selectedStudent.first_name}'s Fee Ledger`
                    : "Fee Ledger"}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  {selectedStudent
                    ? "All fees and outstanding payments for this student."
                    : "Select a student above to focus on their fees."}
                </p>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {loading ? (
              <div className="px-5 py-16 text-center text-sm text-slate-400">
                Loading fee ledger...
              </div>
            ) : visibleFees.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  ₹
                </div>

                <p className="font-semibold text-slate-700">
                  No fees found
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  {selectedStudent
                    ? "This student does not have any fee records yet."
                    : "Search and select a student to view their fee ledger."}
                </p>

                {selectedStudent && (
                  <button
                    onClick={openCreateFee}
                    className="mt-4 rounded-lg bg-[#102A56] px-4 py-2 text-xs font-semibold text-white"
                  >
                    + Add First Fee
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Student
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Fee
                        </th>

                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Total
                        </th>

                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Paid
                        </th>

                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Due
                        </th>

                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Status
                        </th>

                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleFees.map((fee) => {
                        const due = Math.max(
                          fee.amount_due - fee.amount_paid,
                          0,
                        );

                        return (
                          <tr
                            key={fee.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                          >
                            <td className="px-5 py-4">
                              <p className="text-sm font-semibold text-slate-800">
                                {getStudentName(fee.student_id)}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {getStudentAdmissionNumber(
                                  fee.student_id,
                                )}
                                {" · "}
                                {getStudentClass(fee.student_id)}
                              </p>
                            </td>

                            <td className="px-5 py-4 text-sm font-medium text-slate-700">
                              {fee.title}
                            </td>

                            <td className="px-5 py-4 text-right text-sm font-semibold text-slate-700">
                              {formatMoney(fee.amount_due)}
                            </td>

                            <td className="px-5 py-4 text-right text-sm font-semibold text-emerald-600">
                              {formatMoney(fee.amount_paid)}
                            </td>

                            <td className="px-5 py-4 text-right text-sm font-bold text-red-600">
                              {formatMoney(due)}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(
                                  fee.status,
                                )}`}
                              >
                                {fee.status}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                {due > 0 && (
                                  <button
                                    onClick={() => openPayment(fee)}
                                    className="rounded-lg bg-[#102A56] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#16396f]"
                                  >
                                    Collect
                                  </button>
                                )}

                                <button
                                  onClick={() => openHistory(fee)}
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                  History
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="divide-y divide-slate-100 lg:hidden">
                  {visibleFees.map((fee) => {
                    const due = Math.max(
                      fee.amount_due - fee.amount_paid,
                      0,
                    );

                    return (
                      <div key={fee.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800">
                              {getStudentName(fee.student_id)}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {getStudentAdmissionNumber(
                                fee.student_id,
                              )}
                              {" · "}
                              {getStudentClass(fee.student_id)}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(
                              fee.status,
                            )}`}
                          >
                            {fee.status}
                          </span>
                        </div>

                        <div className="mt-4 rounded-xl bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-700">
                            {fee.title}
                          </p>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <AmountMini
                              label="Total"
                              value={formatMoney(fee.amount_due)}
                            />

                            <AmountMini
                              label="Paid"
                              value={formatMoney(fee.amount_paid)}
                            />

                            <AmountMini
                              label="Due"
                              value={formatMoney(due)}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          {due > 0 && (
                            <button
                              onClick={() => openPayment(fee)}
                              className="flex-1 rounded-lg bg-[#102A56] px-3 py-2.5 text-xs font-semibold text-white"
                            >
                              Collect Payment
                            </button>
                          )}

                          <button
                            onClick={() => openHistory(fee)}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600"
                          >
                            History
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Add Fee Modal */}
      {feeModalOpen && selectedStudent && (
        <Modal
          title="Add Fee"
          subtitle={`${selectedStudent.first_name} ${selectedStudent.last_name} · ${selectedStudent.admission_number}`}
          onClose={() => setFeeModalOpen(false)}
        >
          <div className="space-y-4">
            <Input
              label="Fee Title"
              placeholder="e.g. Annual Fee"
              value={feeForm.title}
              onChange={(value) =>
                setFeeForm((current) => ({
                  ...current,
                  title: value,
                }))
              }
            />

            <Input
              label="Amount Due"
              type="number"
              placeholder="25000"
              value={feeForm.amount_due}
              onChange={(value) =>
                setFeeForm((current) => ({
                  ...current,
                  amount_due: value,
                }))
              }
            />

            <button
              onClick={createFee}
              disabled={actionLoading}
              className="w-full rounded-xl bg-[#102A56] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionLoading ? "Saving..." : "Add Fee"}
            </button>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && selectedFee && (
        <Modal
          title="Collect Payment"
          subtitle={`${getStudentName(selectedFee.student_id)} · ${selectedFee.title}`}
          onClose={() => setPaymentModalOpen(false)}
        >
          <div className="mb-5 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Outstanding
              </span>

              <span className="text-lg font-bold text-red-600">
                {formatMoney(
                  selectedFee.amount_due -
                    selectedFee.amount_paid,
                )}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Payment Amount"
              type="number"
              value={paymentForm.amount}
              onChange={(value) =>
                setPaymentForm((current) => ({
                  ...current,
                  amount: value,
                }))
              }
            />

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Payment Method
              </label>

              <select
                value={paymentForm.payment_method}
                onChange={(e) =>
                  setPaymentForm((current) => ({
                    ...current,
                    payment_method: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-400"
              >
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">
                  Bank Transfer
                </option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <Input
              label="Transaction Reference"
              placeholder="Optional"
              value={paymentForm.transaction_reference}
              onChange={(value) =>
                setPaymentForm((current) => ({
                  ...current,
                  transaction_reference: value,
                }))
              }
            />

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Remarks
              </label>

              <textarea
                value={paymentForm.remarks}
                onChange={(e) =>
                  setPaymentForm((current) => ({
                    ...current,
                    remarks: e.target.value,
                  }))
                }
                rows={3}
                placeholder="Optional note..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-400"
              />
            </div>

            <button
              onClick={createPayment}
              disabled={actionLoading}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {actionLoading
                ? "Processing..."
                : "Record Payment"}
            </button>
          </div>
        </Modal>
      )}

      {/* Payment History */}
      {historyModalOpen && historyFee && (
        <Modal
          title="Payment History"
          subtitle={`${getStudentName(historyFee.student_id)} · ${historyFee.title}`}
          onClose={() => setHistoryModalOpen(false)}
          wide
        >
          {historyLoading ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Loading payment history...
            </div>
          ) : payments.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No payments recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {formatMoney(payment.amount)}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(payment.payment_date)}
                        {" · "}
                        {payment.payment_method}
                      </p>

                      {payment.transaction_reference && (
                        <p className="mt-1 text-xs text-slate-500">
                          Ref:{" "}
                          {payment.transaction_reference}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        {payment.receipt_number}
                      </span>

                      <button
                        onClick={() =>
                          openReceipt(payment.id)
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Receipt
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Receipt */}
      {receiptModalOpen && (
        <Modal
          title="Fee Receipt"
          subtitle="Payment receipt"
          onClose={() => setReceiptModalOpen(false)}
          wide
        >
          {receiptLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Loading receipt...
            </div>
          ) : !receipt ? (
            <div className="py-12 text-center text-sm text-red-500">
              Receipt could not be loaded.
            </div>
          ) : (
            <div className="print-receipt">
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-[#102A56] px-5 py-6 text-white">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xl font-bold">
                        EduOS
                      </p>

                      <p className="mt-1 text-xs text-blue-100">
                        Fee Payment Receipt
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-xs text-blue-100">
                        Receipt No.
                      </p>

                      <p className="mt-1 font-bold">
                        {receipt.receipt_number}
                      </p>

                      <p className="mt-1 text-xs text-blue-100">
                        {formatDate(receipt.payment_date)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Student
                      </p>

                      <p className="mt-1 text-base font-bold text-slate-800">
                        {receipt.student_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Admission No:{" "}
                        {receipt.admission_number}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Class:{" "}
                        {receipt.class_name || "Not assigned"}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Fee Head
                      </p>

                      <p className="mt-1 text-base font-bold text-slate-800">
                        {receipt.fee_title}
                      </p>
                    </div>
                  </div>

                  <div className="my-6 border-t border-dashed border-slate-200" />

                  <div className="space-y-3">
                    <ReceiptRow
                      label="Total Fee"
                      value={formatMoney(
                        receipt.total_amount,
                      )}
                    />

                    <ReceiptRow
                      label="Previously Paid"
                      value={formatMoney(
                        receipt.previously_paid,
                      )}
                    />

                    <ReceiptRow
                      label="This Payment"
                      value={formatMoney(
                        receipt.payment_amount,
                      )}
                      strong
                    />

                    <ReceiptRow
                      label="Total Paid"
                      value={formatMoney(
                        receipt.total_paid,
                      )}
                    />

                    <ReceiptRow
                      label="Remaining Due"
                      value={formatMoney(
                        receipt.remaining_amount,
                      )}
                      danger
                    />
                  </div>

                  <div className="my-6 border-t border-dashed border-slate-200" />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Payment Method
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {receipt.payment_method}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Transaction Reference
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {receipt.transaction_reference ||
                          "—"}
                      </p>
                    </div>
                  </div>

                  {receipt.remarks && (
                    <div className="mt-5 rounded-xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Remarks
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {receipt.remarks}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end print:hidden">
                    <button
                      onClick={printReceipt}
                      className="rounded-xl bg-[#102A56] px-5 py-3 text-sm font-semibold text-white"
                    >
                      🖨 Print Receipt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-[10px] text-blue-100">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function AmountMini({
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

function ReceiptRow({
  label,
  value,
  strong = false,
  danger = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`text-sm ${
          strong
            ? "font-bold text-slate-800"
            : "text-slate-500"
        }`}
      >
        {label}
      </span>

      <span
        className={`text-sm ${
          danger
            ? "font-bold text-red-600"
            : strong
              ? "font-bold text-emerald-600"
              : "font-semibold text-slate-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Input({
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
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      />
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
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-bold text-[#102A56]">
              {title}
            </h3>

            {subtitle && (
              <p className="mt-1 text-xs text-slate-400">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}