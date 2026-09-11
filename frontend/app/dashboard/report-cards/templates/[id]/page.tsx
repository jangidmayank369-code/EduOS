"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Retains legacy /templates/:id links without a second editor. */
export default function LegacyTemplateRoute() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  useEffect(() => {
    router.replace(`/dashboard/report-cards/templates?id=${encodeURIComponent(params.id)}`);
  }, [params.id, router]);

  return <div className="min-h-screen bg-slate-100" />;
}
