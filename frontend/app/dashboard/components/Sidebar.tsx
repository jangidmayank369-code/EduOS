"use client";

import { usePathname, useRouter } from "next/navigation";

const menuItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: "▦",
  },
  {
    label: "Students",
    path: "/dashboard/students",
    icon: "♙",
  },
  {
    label: "Teachers",
    path: "/dashboard/teachers",
    icon: "♟",
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
    label: "Class Subjects",
    path: "/dashboard/class-subjects",
    icon: "◇",
  },
  {
    label: "Attendance",
    path: "/dashboard/attendance",
    icon: "✓",
  },
  {
    label: "Exams & Marks",
    path: "/dashboard/exams",
    icon: "▣",
  },
  {
    label: "Assignments",
    path: "/dashboard/assignments",
    icon: "□",
  },
  {
    label: "Fees",
    path: "/dashboard/fees",
    icon: "₹",
  },
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
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="border-b border-slate-100 px-6 py-6">
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Workspace
        </p>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const active =
              item.path === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.path);

            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all ${
                  active
                    ? "bg-[#102A56] text-white shadow-md shadow-blue-900/15"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#102A56]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 h-6 w-1 rounded-r-full bg-blue-400" />
                )}

                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                    active
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-[#102A56] group-hover:bg-blue-50"
                  }`}
                >
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System status */}
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