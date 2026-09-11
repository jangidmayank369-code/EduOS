"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { reportCardsFetch } from "../../components/api";
import { ReportCardElementRenderer, type ReportCardData } from "../../components/ReportCardRenderer";
import { normalizeReportCardTemplate, templatePageDimensions } from "../../components/types";

type ApiReportCard = ReportCardData & { template: unknown };

export default function StudentReportCardPage() {
  const params = useParams<{ studentId: string }>();
  const searchParams = useSearchParams();
  const [report, setReport] = useState<ApiReportCard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams();
    const templateId = searchParams.get("template_id");
    const examId = searchParams.get("exam_id");
    if (templateId) query.set("template_id", templateId);
    if (examId) query.set("exam_id", examId);
    reportCardsFetch<ApiReportCard>(`/report-cards/student/${encodeURIComponent(params.studentId)}${query.size ? `?${query}` : ""}`)
      .then(setReport)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load report card."));
  }, [params.studentId, searchParams]);

  const template = useMemo(() => report ? normalizeReportCardTemplate(report.template) : null, [report]);
  if (error) return <div className="min-h-screen bg-slate-100 p-8 text-red-700">{error}</div>;
  if (!template || !report) return <div className="min-h-screen bg-slate-100 p-8">Loading report card…</div>;

  const dimensions = templatePageDimensions(template);
  const printSize = `${template.page_size} ${template.orientation}`;
  return <main className="min-h-screen bg-slate-200 p-8 print:bg-white print:p-0">
    <style>{`@page { size: ${printSize}; margin: 0; } @media print { body * { visibility: hidden; } #student-report-card, #student-report-card * { visibility: visible; } #student-report-card { position: absolute; left: 0; top: 0; box-shadow: none !important; } }`}</style>
    <button onClick={() => window.print()} className="mb-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white print:hidden">Print / PDF</button>
    <section id="student-report-card" className="relative mx-auto overflow-hidden bg-white shadow-2xl" style={{ width: dimensions.width, height: dimensions.height, fontFamily: String((template.settings.theme as Record<string, unknown> | undefined)?.fontFamily || "Arial") }}>
      {template.elements.filter(element => element.visible).sort((a, b) => a.zIndex - b.zIndex).map(element => <div key={element.id} className="absolute overflow-hidden" style={{ left: element.x, top: element.y, width: element.width, height: element.height, zIndex: element.zIndex }}><ReportCardElementRenderer template={template} element={element} data={report} /></div>)}
    </section>
  </main>;
}
