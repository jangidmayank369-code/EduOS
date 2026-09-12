"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("user_role")?.trim().toLowerCase();
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    // Teachers must never enter the admin dashboard.
    if (role === "teacher") {
      router.replace("/teacher");
      return;
    }

    // Keep the existing admin dashboard under /dashboard/admin.
    router.replace("/dashboard/admin");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
        Opening your dashboard…
      </div>
    </main>
  );
}
