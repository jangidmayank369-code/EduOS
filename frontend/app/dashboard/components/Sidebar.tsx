"use client";

import { usePathname, useRouter } from "next/navigation";

const menuItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "▦",
  },

  // Student & People
  {
    label: "Students",
    path: "/dashboard/students",
    icon: "♙",
  },
  {
    label: "Parents",
    path: "/dashboard/parents",
    icon: "♧",
  },
  {
    label: "Teacher",
    path: "/dashboard/teacher",
    icon: "♟",
  },

  // Academic Setup
  {
    label: "Academic Sessions",
    path: "/dashboard/academic-sessions",
    icon: "◷",
  },
  {
    label: "Classes",
    path: "/dashboard/classes",
    icon: "▤",
  },
  {
    label: "Subjects",
    path: "/dashboard/subjects",
    icon: "◆",
  },
  {
    label: "Co-Scholastic",
    path: "/dashboard/co-scholastic",
    icon: "◇",
  },
  {
  label: "Teacher Tasks",
  path: "/dashboard/teacher-tasks",
  },
  {
    label: "Teacher Assignments",
    path: "/dashboard/teacher-assignments",
    icon: "◆",
  },

  // Academic Operations
  {
    label: "Attendance",
    path: "/dashboard/attendance",
    icon: "✓",
  },
  {
    label: "Exams",
    path: "/dashboard/exams",
    icon: "▣",
  },
  {
    label: "Marks Entry",
    path: "/dashboard/marks",
    icon: "✎",
  },
  {
    label: "Results",
    path: "/dashboard/results",
    icon: "▤",
  },
  {
    label: "Report Cards",
    path: "/dashboard/report-cards",
    icon: "▥",
  },

  // Other Academic
  {
    label: "Assignments",
    path: "/dashboard/assignments",
    icon: "□",
  },

  // Finance
  {
    label: "Fees",
    path: "/dashboard/fees",
    icon: "₹",
  },

  // Communication
  {
    label: "Notices",
    path: "/dashboard/notices",
    icon: "!",
  },
  {
    label: "Notifications",
    path: "/dashboard/notifications",
    icon: "◉",
  },

  // Administration
  {
    label: "Users",
    path: "/dashboard/users",
    icon: "♙",
  },
  {
    label: "Access Control",
    path: "/dashboard/roles",
    icon: "⚿",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }

    return (
      pathname === path ||
      pathname.startsWith(`${path}/`)
    );
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="border-b border-slate-100 px-6 py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#102A56] text-lg font-bold text-white shadow-lg shadow-blue-900/20">
            E
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#102A56]">
              EduOS
            </h1>

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Intelligence Platform
            </p>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Workspace
        </p>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-[#102A56] text-white shadow-md shadow-blue-900/20"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#102A56]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-400" />
                )}

                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm transition-all ${
                    active
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-[#102A56] group-hover:bg-blue-50"
                  }`}
                >
                  {item.icon}
                </span>

                <span className="truncate">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="border-t border-slate-100 px-4 py-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />

          <span className="text-xs font-medium text-emerald-700">
            EduOS systems operational
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
            ↪
          </span>

          Logout
        </button>
      </div>
    </aside>
  );
}