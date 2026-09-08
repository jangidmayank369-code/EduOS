"use client";

import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";

type DashboardData = {
  // Admin
  total_students?: number;
  total_teachers?: number;
  total_classes?: number;
  total_subjects?: number;
  total_pending_fee_amount?: number;
  active_assignments?: number;

  // Teacher
  teacher_id?: number;
  assigned_classes?: number;
  assigned_subjects?: number;
  pending_submissions?: number;

  // Student
  student_id?: number;
  attendance_percentage?: number;
  total_marks_entries?: number;
  latest_marks?: unknown[];
  pending_assignments?: number;
  unread_notifications?: number;

  // Parent
  parent_id?: number;
  children_count?: number;
  children?: unknown[];
};

const API_URL = "http://127.0.0.1:8000";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const token = localStorage.getItem("access_token");

    if (!role || !token) {
      window.location.href = "/login";
      return;
    }

    setUserRole(role);

    const fetchDashboard = async () => {
      try {
        const response = await fetch(`${API_URL}/dashboard/${role}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_role");
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard");
        }

        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const roleName =
    userRole.length > 0
      ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
      : "Admin";

  const formatCurrency = (amount = 0) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    /*
      IMPORTANT:
      h-screen + overflow-hidden keeps the application inside viewport.
      Sidebar and main content don't push the page downward.
    */
    <div className="flex h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      {/* SIDEBAR */}
      <div className="h-screen shrink-0">
        <Sidebar />
      </div>

      {/* MAIN DASHBOARD */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {/* TOP HEADER */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[76px] items-center justify-between px-6 py-4 lg:px-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#315b9b]">
                EduOS Intelligence Platform
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
                Dashboard
              </h1>

              <p className="mt-0.5 text-xs text-slate-500">
                School overview and management
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 md:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                System Operational
              </div>

              <div className="rounded-xl bg-[#102a56] px-4 py-2 text-sm font-semibold text-white shadow-sm">
                {roleName}
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="w-full px-6 py-7 lg:px-8">
          {/* WELCOME BANNER */}
          <section className="relative overflow-hidden rounded-3xl bg-[#102a56] p-7 shadow-[0_10px_35px_rgba(16,42,86,0.12)]">
            {/* Decorative shapes */}
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[32px] border-blue-300/10" />

            <div className="absolute -bottom-28 right-40 h-56 w-56 rounded-full border-[24px] border-cyan-300/10" />

            <div className="absolute right-10 top-10 h-4 w-4 rounded-full bg-cyan-300/70" />

            <div className="relative z-10 max-w-3xl">
              <div className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100">
                <span className="mr-2 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                Real-time school overview
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-white">
                Welcome to EduOS 👋
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
                Your centralized school management workspace. Monitor
                students, teachers, classes, academics and operations from
                one intelligent platform.
              </p>
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* ================= ADMIN ================= */}
          {userRole === "admin" && (
            <>
              {/* STATS */}
              <section className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  title="Total Students"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.total_students ?? 0)
                  }
                  description="Students enrolled"
                  icon="👨‍🎓"
                />

                <StatCard
                  title="Total Teachers"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.total_teachers ?? 0)
                  }
                  description="Teaching staff"
                  icon="👨‍🏫"
                />

                <StatCard
                  title="Total Classes"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.total_classes ?? 0)
                  }
                  description="Active classes"
                  icon="🏫"
                />

                <StatCard
                  title="Total Subjects"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.total_subjects ?? 0)
                  }
                  description="Subjects offered"
                  icon="📚"
                />

                <StatCard
                  title="Pending Fees"
                  value={
                    loading
                      ? "..."
                      : formatCurrency(
                          dashboard?.total_pending_fee_amount ?? 0
                        )
                  }
                  description="Outstanding amount"
                  icon="₹"
                  highlight
                />

                <StatCard
                  title="Active Assignments"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.active_assignments ?? 0)
                  }
                  description="Currently active"
                  icon="📝"
                />
              </section>

              {/* QUICK ACTIONS */}
              <QuickActions />

              {/* AI */}
              <AISection />
            </>
          )}

          {/* ================= TEACHER ================= */}
          {userRole === "teacher" && (
            <>
              <section className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  title="Assigned Classes"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.assigned_classes ?? 0)
                  }
                  description="Classes assigned to you"
                  icon="🏫"
                />

                <StatCard
                  title="Assigned Subjects"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.assigned_subjects ?? 0)
                  }
                  description="Subjects you teach"
                  icon="📚"
                />

                <StatCard
                  title="Total Students"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.total_students ?? 0)
                  }
                  description="Students under your classes"
                  icon="👨‍🎓"
                />

                <StatCard
                  title="Active Assignments"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.active_assignments ?? 0)
                  }
                  description="Currently active"
                  icon="📝"
                />

                <StatCard
                  title="Pending Submissions"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.pending_submissions ?? 0)
                  }
                  description="Need your review"
                  icon="📋"
                />
              </section>

              <QuickActions />

              <AISection />
            </>
          )}

          {/* ================= STUDENT ================= */}
          {userRole === "student" && (
            <>
              <section className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  title="Attendance"
                  value={
                    loading
                      ? "..."
                      : `${dashboard?.attendance_percentage ?? 0}%`
                  }
                  description="Overall attendance"
                  icon="📅"
                />

                <StatCard
                  title="Marks Entries"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.total_marks_entries ?? 0)
                  }
                  description="Academic marks recorded"
                  icon="📊"
                />

                <StatCard
                  title="Pending Assignments"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.pending_assignments ?? 0)
                  }
                  description="Assignments remaining"
                  icon="📝"
                />

                <StatCard
                  title="Notifications"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.unread_notifications ?? 0)
                  }
                  description="Unread notifications"
                  icon="🔔"
                />
              </section>

              <QuickActions />

              <AISection />
            </>
          )}

          {/* ================= PARENT ================= */}
          {userRole === "parent" && (
            <>
              <section className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  title="Children"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.children_count ?? 0)
                  }
                  description="Children linked to account"
                  icon="👨‍👩‍👧"
                />

                <StatCard
                  title="Notifications"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.unread_notifications ?? 0)
                  }
                  description="Unread notifications"
                  icon="🔔"
                />

                <StatCard
                  title="Student Profiles"
                  value={
                    loading
                      ? "..."
                      : String(dashboard?.children?.length ?? 0)
                  }
                  description="Available child profiles"
                  icon="🎓"
                />
              </section>

              {/* CHILDREN */}
              <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                    Family Overview
                  </p>

                  <h3 className="mt-1 text-xl font-bold text-[#102a56]">
                    Your Children
                  </h3>
                </div>

                {dashboard?.children &&
                dashboard.children.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {dashboard.children.map(
                      (child: any, index: number) => (
                        <div
                          key={child.student_id ?? index}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                        >
                          <h4 className="font-bold text-[#102a56]">
                            {child.name || "Student"}
                          </h4>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-400">
                                Attendance
                              </p>
                              <p className="mt-1 font-semibold text-slate-700">
                                {child.attendance_percentage ?? 0}%
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-400">
                                Pending Assignments
                              </p>
                              <p className="mt-1 font-semibold text-slate-700">
                                {child.pending_assignments ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No children linked yet.
                  </div>
                )}
              </section>

              <QuickActions />

              <AISection />
            </>
          )}

          {/* BOTTOM SPACE */}
          <div className="h-10" />
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  description,
  icon,
  highlight = false,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
      <div className="absolute left-0 top-0 h-1 w-full bg-[#102a56]" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p
            className={`mt-3 truncate text-3xl font-bold tracking-tight ${
              highlight ? "text-[#102a56]" : "text-slate-900"
            }`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   QUICK ACTIONS
========================================================= */

function QuickActions() {
  const actions = [
    {
      title: "Manage Students",
      description: "View and manage student records",
      icon: "👨‍🎓",
      href: "/dashboard/students",
    },
    {
      title: "Manage Teachers",
      description: "View teaching staff and profiles",
      icon: "👨‍🏫",
      href: "/dashboard/teachers",
    },
    {
      title: "Manage Classes",
      description: "Create and manage school classes",
      icon: "🏫",
      href: "/dashboard/classes",
    },
    {
      title: "Manage Subjects",
      description: "Manage academic subjects",
      icon: "📚",
      href: "/dashboard/subjects",
    },
    {
      title: "Class Subjects",
      description: "Assign subjects to classes",
      icon: "🔗",
      href: "/dashboard/class-subjects",
    },
    {
      title: "Attendance",
      description: "Track student attendance",
      icon: "📅",
      href: "/dashboard/attendance",
    },
    {
      title: "Exams & Marks",
      description: "Manage exams and academic results",
      icon: "📊",
      href: "/dashboard/exams",
    },
    {
      title: "Assignments",
      description: "Create and track assignments",
      icon: "📝",
      href: "/dashboard/assignments",
    },
    {
      title: "Fees",
      description: "Monitor school fee payments",
      icon: "💰",
      href: "/dashboard/fees",
    },
  ];

  return (
    <section className="mt-8">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
          Workspace
        </p>

        <h3 className="mt-1 text-xl font-bold text-[#102a56]">
          Quick Actions
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={() => {
              window.location.href = action.href;
            }}
            className="group flex min-h-[145px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#102a56] text-lg text-white">
                {action.icon}
              </div>

              <span className="text-xl text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-[#102a56]">
                →
              </span>
            </div>

            <div className="mt-5">
              <h4 className="font-bold text-[#102a56]">
                {action.title}
              </h4>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   AI SECTION
========================================================= */

function AISection() {
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative p-7">
        <div className="absolute right-8 top-8 h-24 w-24 rounded-full border-[12px] border-blue-50" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#315b9b]">
              AI Intelligence
            </div>

            <h3 className="text-2xl font-bold text-[#102a56]">
              EduOS AI Assistant
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Intelligent insights, student performance analysis,
              teacher assistance and school knowledge search will power
              the next generation of EduOS.
            </p>
          </div>

          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#102a56] text-3xl text-white shadow-lg">
            ✦
          </div>
        </div>
      </div>
    </section>
  );
}