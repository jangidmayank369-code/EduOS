"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function RoleDashboardRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/dashboard") return;

    const role = localStorage.getItem("user_role")?.trim().toLowerCase();

    if (role === "teacher") {
      router.replace("/teacher");
    }
  }, [pathname, router]);

  return null;
}
