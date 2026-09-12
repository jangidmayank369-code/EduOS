"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type TeacherWorkspace = {
  teacher?: {
    id: number;
    employee_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  };
  total_sections?: number;
  total_students?: number;
  total_subject_assignments?: number;
};

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

const workspaceNav: NavItem[] = [
  { label: "Dashboard", href: "/teacher", icon: "⌂" },
];

const academicNav: NavItem[] = [
  { label: "My Students", href: "/teacher/students", icon: "♙" },
  { label: "Attendance", href: "/teacher/attendance", icon: "✓" },
  { label: "Marks & Tests", href: "/teacher/marks", icon: "▤" },
  { label: "Homework / Work", href: "/teacher/homework", icon: "▣" },
  { label: "Timetable", href: "/teacher/timetable", icon: "◷" },
];

const communicationNav: NavItem[] = [
  { label: "Parent Contact", href: "/teacher/parents", icon: "◌" },
  { label: "My Tasks", href: "/teacher/tasks", icon: "☑" },
];

const accountNav: NavItem[] = [
  { label: "My 360° Profile", href: "/teacher/profile", icon: "◎" },
];

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || "";
}

function fullName(teacher?: TeacherWorkspace["teacher"]) {
  if (!teacher) return "Teacher";
  return (
    `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || "Teacher"
  );
}

function initials(teacher?: TeacherWorkspace["teacher"]) {
  return fullName(teacher)
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function loadWorkspace(): Promise<TeacherWorkspace | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API}/teacher/me/workspace`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      return null;
    }

    if (!response.ok) return null;
    return (await response.json()) as TeacherWorkspace;
  } catch {
    return null;
  }
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        router.push(item.href);
        onNavigate?.();
      }}
      className={[
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all",
        active
          ? "bg-[#102a56] text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-[#102a56]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base",
          active
            ? "bg-white/10 text-white"
            : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#102a56]",
        ].join(" ")}
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {active ? (
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      ) : null}
    </button>
  );
}

function SidebarSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <section className="mt-6">
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={
              item.href === "/teacher"
                ? pathname === "/teacher"
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            }
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

function pageTitle(pathname: string) {
  if (pathname === "/teacher") return "Dashboard";

  const last =
    pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") || "Teacher App";

  return last.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function TeacherLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();

  const [workspace, setWorkspace] = useState<TeacherWorkspace | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    void loadWorkspace().then((result) => {
      if (!mounted) return;

      if (!result && !getToken()) {
        router.replace("/login");
        return;
      }

      setWorkspace(result);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const teacherName = useMemo(
    () => fullName(workspace?.teacher),
    [workspace]
  );

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div
        className={[
          "fixed inset-0 z-40 bg-slate-950/35 transition lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102a56] text-sm font-black text-white">
            E
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold tracking-tight text-[#102a56]">
              EduOS
            </div>
            <div className="truncate text-[11px] font-medium text-slate-400">
              Teacher Workspace
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="border-b border-slate-200 px-4 py-4">
          <button
            type="button"
            onClick={() => router.push("/teacher/profile")}
            className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-slate-100"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102a56] text-sm font-bold text-white">
              {initials(workspace?.teacher)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">
                {teacherName}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                {workspace?.teacher?.employee_number || "Teacher Account"}
              </div>
            </div>
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <SidebarSection
            title="Workspace"
            items={workspaceNav}
            pathname={pathname}
            onNavigate={() => setSidebarOpen(false)}
          />
          <SidebarSection
            title="Academic"
            items={academicNav}
            pathname={pathname}
            onNavigate={() => setSidebarOpen(false)}
          />
          <SidebarSection
            title="Communication"
            items={communicationNav}
            pathname={pathname}
            onNavigate={() => setSidebarOpen(false)}
          />
          <SidebarSection
            title="Account"
            items={accountNav}
            pathname={pathname}
            onNavigate={() => setSidebarOpen(false)}
          />
        </nav>

        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#102a56]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              ↪
            </span>
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[270px]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[76px] items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
                Teacher Workspace
              </p>
              <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-[#102a56]">
                {pageTitle(pathname)}
              </h1>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="text-slate-400">Sections</span>{" "}
                {workspace?.total_sections ?? "—"}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="text-slate-400">Students</span>{" "}
                {workspace?.total_students ?? "—"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/teacher/profile")}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102a56] text-xs font-bold text-white shadow-sm transition hover:bg-[#173b75]"
              aria-label="Open teacher profile"
            >
              {initials(workspace?.teacher)}
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-76px)]">{children}</main>
      </div>
    </div>
  );
}
