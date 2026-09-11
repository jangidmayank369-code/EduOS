/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportCardElementRenderer } from "./ReportCardRenderer";
import { normalizeReportCardTemplate, templatePageDimensions } from "./types";
import { REPORT_CARDS_API_BASE } from "./api";

const API_URL = REPORT_CARDS_API_BASE;

type Theme = {
  primary?: string;
  secondary?: string;
  accent?: string;
  gold?: string;
  headerBg?: string;
  tableHeader?: string;
  softBg?: string;
  border?: string;
  text?: string;
  muted?: string;
  success?: string;
  fontFamily?: string;
  borderRadius?: number;
};

type SubjectConfig = {
  subject_id?: number;
  name?: string;
  code?: string;
  max_marks?: number;
  pass_marks?: number;
  enabled?: boolean;
  display_order?: number;
  show_max_marks?: boolean;
  show_pass_marks?: boolean;
  show_obtained?: boolean;
  show_grade?: boolean;
  show_remark?: boolean;
};

type BuilderSettings = {
  page?: {
    size?: string;
    orientation?: string;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
  };
  academic?: {
    enabled?: boolean;
    title?: string;
    showMaxMarks?: boolean;
    showPassMarks?: boolean;
    showObtained?: boolean;
    showGrade?: boolean;
    showRemark?: boolean;
    columns?: string[];
    subjects?: SubjectConfig[];
  };
  academic_subjects?: SubjectConfig[];
  co_scholastic?: {
    enabled?: boolean;
    title?: string;
    showGrade?: boolean;
    showRemark?: boolean;
    subjects?: Array<{
      id?: string;
      component_id?: number;
      name?: string;
      gradeBased?: boolean;
      active?: boolean;
    }>;
  };
  co_scholastic_subjects?: Array<{
    id?: string;
    component_id?: number;
    name?: string;
    gradeBased?: boolean;
    active?: boolean;
  }>;
  result?: {
    enabled?: boolean;
    title?: string;
    showTotal?: boolean;
    showPercentage?: boolean;
    showGrade?: boolean;
    showDivision?: boolean;
    showResult?: boolean;
    showRank?: boolean;
  };
  attendance?: {
    enabled?: boolean;
    showWorkingDays?: boolean;
    showPresentDays?: boolean;
    showPercentage?: boolean;
  };
  remarks?: {
    enabled?: boolean;
    classTeacher?: boolean;
    principal?: boolean;
  };
  signatures?: {
    enabled?: boolean;
    classTeacher?: boolean;
    principal?: boolean;
    parent?: boolean;
  };
  theme?: Theme;
  school?: {
    name?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
  };
};

type BuilderElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  style?: Record<string, any>;
  props?: Record<string, any>;
};

type Template = {
  id?: number;
  name: string;
  description?: string | null;
  class_id?: number | null;
  academic_session_id?: number | null;
  exam_id?: number | null;
  page_size?: string;
  orientation?: string;
  status?: string;
  is_default?: boolean;
  elements?: BuilderElement[];
  settings?: BuilderSettings;
  created_at?: string;
  updated_at?: string;
};

type PaletteItem = {
  type: string;
  label: string;
  icon: string;
  description: string;
};

type ClassItem = {
  id: number;
  name?: string;
  class_name?: string;
};

type ExamItem = {
  id: number;
  name?: string;
  exam_name?: string;
  exam_type?: string;
  academic_year?: string;
  term?: string;
  academic_session_id?: number | null;
};

type SessionItem = {
  id: number;
  name?: string;
  session_name?: string;
  academic_year?: string;
  is_active?: boolean;
};

type CoScholasticComponent = {
  id: number;
  name: string;
  class_id?: number | null;
  grade_based?: boolean;
  is_active?: boolean;
  display_order?: number;
};

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || "";
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please login again.");
  }

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" && data?.detail
        ? typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail)
        : `Request failed with status ${response.status}`;

    throw new Error(detail);
  }

  return data;
}

const DEFAULT_THEME: Theme = {
  primary: "#0f172a",
  secondary: "#334155",
  accent: "#2563eb",
  gold: "#b8891d",
  headerBg: "#f8fafc",
  tableHeader: "#e2e8f0",
  softBg: "#f8fafc",
  border: "#cbd5e1",
  text: "#0f172a",
  muted: "#64748b",
  success: "#15803d",
  fontFamily: "Arial, Helvetica, sans-serif",
  borderRadius: 8,
};

const DEFAULT_SETTINGS: BuilderSettings = {
  page: {
    size: "A4",
    orientation: "portrait",
    marginTop: 24,
    marginRight: 24,
    marginBottom: 24,
    marginLeft: 24,
  },
  academic: {
    enabled: true,
    title: "Academic Performance",
    showMaxMarks: true,
    showPassMarks: true,
    showObtained: true,
    showGrade: true,
    showRemark: true,
    columns: [
      "subject",
      "max_marks",
      "pass_marks",
      "obtained",
      "grade",
      "remark",
    ],
    subjects: [],
  },
  academic_subjects: [],
  co_scholastic: {
    enabled: true,
    title: "Co-Scholastic Activities",
    showGrade: true,
    showRemark: true,
    subjects: [],
  },
  co_scholastic_subjects: [],
  result: {
    enabled: true,
    title: "Result Summary",
    showTotal: true,
    showPercentage: true,
    showGrade: true,
    showDivision: true,
    showResult: true,
    showRank: true,
  },
  attendance: {
    enabled: true,
    showWorkingDays: true,
    showPresentDays: true,
    showPercentage: true,
  },
  remarks: {
    enabled: true,
    classTeacher: true,
    principal: true,
  },
  signatures: {
    enabled: true,
    classTeacher: true,
    principal: true,
    parent: true,
  },
  theme: DEFAULT_THEME,
  school: {
    name: "Wisdom Public School",
    tagline: "Excellence in Education",
    address: "School Address",
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
  },
};

const PALETTE: PaletteItem[] = [
  {
    type: "school_header",
    label: "School Header",
    icon: "🏫",
    description: "School logo, name, tagline and contact details",
  },
  {
    type: "report_title",
    label: "Report Title",
    icon: "📄",
    description: "Academic Report Card heading",
  },
  {
    type: "result_date",
    label: "Result Date",
    icon: "📅",
    description: "Declaration/result date",
  },
  {
    type: "student_details",
    label: "Student Details",
    icon: "👨‍🎓",
    description: "Student information grid",
  },
  {
    type: "academic_table",
    label: "Marks Details",
    icon: "📊",
    description: "Academic subjects and marks",
  },
  {
    type: "co_scholastic",
    label: "Co-Scholastic",
    icon: "🎨",
    description: "Co-scholastic activities",
  },
  {
    type: "result_summary",
    label: "Result Summary",
    icon: "🏆",
    description: "Total, percentage, grade, division and result",
  },
  {
    type: "attendance",
    label: "Attendance",
    icon: "📆",
    description: "Working days, present days and percentage",
  },
  {
    type: "remarks",
    label: "Remarks",
    icon: "💬",
    description: "Teacher and principal remarks",
  },
  {
    type: "signatures",
    label: "Signatures",
    icon: "✍️",
    description: "Signature area",
  },
  {
    type: "logo",
    label: "Logo / Image",
    icon: "🖼️",
    description: "School logo or custom image",
  },
  {
    type: "section_heading",
    label: "Section Heading",
    icon: "🔖",
    description: "Custom section heading",
  },
  {
    type: "custom_text",
    label: "Custom Text",
    icon: "T",
    description: "Free-form custom text",
  },
  {
    type: "divider",
    label: "Divider",
    icon: "➖",
    description: "Horizontal divider",
  },
];

const PLACEHOLDERS = [
  "{{student_name}}",
  "{{father_name}}",
  "{{mother_name}}",
  "{{class_name}}",
  "{{section}}",
  "{{roll_no}}",
  "{{admission_no}}",
  "{{dob}}",
  "{{gender}}",
  "{{category}}",
  "{{academic_session}}",
  "{{exam_name}}",
  "{{total_marks}}",
  "{{max_marks}}",
  "{{percentage}}",
  "{{grade}}",
  "{{division}}",
  "{{result}}",
  "{{rank}}",
  "{{attendance_percentage}}",
  "{{class_teacher_remark}}",
  "{{principal_remark}}",
  "{{school_name}}",
];

function createElement(
  type: string,
  index: number,
  overrides: Partial<BuilderElement> = {},
  stableId?: string
): BuilderElement {
  const defaults: Record<string, Partial<BuilderElement>> = {
    school_header: {
      x: 24,
      y: 24,
      width: 546,
      height: 86,
      style: {
        backgroundColor: "#ffffff",
        borderColor: "#cbd5e1",
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        textAlign: "center",
      },
      props: {},
    },
    report_title: {
      x: 24,
      y: 122,
      width: 546,
      height: 42,
      style: {
        fontSize: 22,
        fontWeight: 700,
        color: "#0f172a",
        textAlign: "center",
      },
      props: {
        text: "ACADEMIC REPORT CARD",
      },
    },
    result_date: {
      x: 24,
      y: 170,
      width: 546,
      height: 28,
      style: {
        fontSize: 11,
        color: "#64748b",
        textAlign: "right",
      },
      props: {
        label: "Result Declaration Date",
      },
    },
    student_details: {
      x: 24,
      y: 208,
      width: 546,
      height: 116,
      style: {
        borderColor: "#cbd5e1",
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
      },
      props: {
        columns: 2,
      },
    },
    academic_table: {
      x: 24,
      y: 334,
      width: 546,
      height: 220,
      style: {
        borderColor: "#cbd5e1",
        borderWidth: 1,
        borderRadius: 6,
        fontSize: 10,
      },
      props: {},
    },
    co_scholastic: {
      x: 24,
      y: 564,
      width: 546,
      height: 120,
      style: {
        borderColor: "#cbd5e1",
        borderWidth: 1,
        borderRadius: 6,
        fontSize: 10,
      },
      props: {},
    },
    result_summary: {
      x: 24,
      y: 694,
      width: 546,
      height: 80,
      style: {
        borderColor: "#cbd5e1",
        borderWidth: 1,
        borderRadius: 6,
        fontSize: 10,
      },
      props: {},
    },
    attendance: {
      x: 24,
      y: 784,
      width: 546,
      height: 58,
      style: {
        borderColor: "#cbd5e1",
        borderWidth: 1,
        borderRadius: 6,
        fontSize: 10,
      },
      props: {},
    },
    remarks: {
      x: 24,
      y: 852,
      width: 546,
      height: 72,
      style: {
        borderColor: "#cbd5e1",
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
        fontSize: 10,
      },
      props: {},
    },
    signatures: {
      x: 24,
      y: 934,
      width: 546,
      height: 66,
      style: {
        fontSize: 10,
      },
      props: {},
    },
    logo: {
      x: 44,
      y: 36,
      width: 60,
      height: 60,
      style: {
        objectFit: "contain",
      },
      props: {
        src: "",
      },
    },
    section_heading: {
      x: 24,
      y: 1040,
      width: 546,
      height: 32,
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: "#0f172a",
      },
      props: {
        text: "Section Heading",
      },
    },
    custom_text: {
      x: 24,
      y: 1082,
      width: 546,
      height: 52,
      style: {
        fontSize: 12,
        color: "#0f172a",
      },
      props: {
        text: "Custom text",
      },
    },
    divider: {
      x: 24,
      y: 1150,
      width: 546,
      height: 2,
      style: {
        backgroundColor: "#cbd5e1",
      },
      props: {},
    },
  };

  return {
    // Default canvas elements receive deterministic IDs so the initial
    // server render and client hydration produce identical markup.
    // Dynamically added elements keep the existing time-based uniqueness.
    id: stableId ?? `${type}-${Date.now()}-${index}`,
    type,
    x: 24,
    y: 24,
    width: 546,
    height: 60,
    zIndex: index + 1,
    visible: true,
    locked: false,
    style: {},
    props: {},
    ...(defaults[type] || {}),
    ...overrides,
  };
}

const DEFAULT_ELEMENTS: BuilderElement[] = [
  createElement("school_header", 0, {}, "school_header-default"),
  createElement("report_title", 1, {}, "report_title-default"),
  createElement("result_date", 2, {}, "result_date-default"),
  createElement("student_details", 3, {}, "student_details-default"),
  createElement("academic_table", 4, {}, "academic_table-default"),
  createElement("co_scholastic", 5, {}, "co_scholastic-default"),
  createElement("result_summary", 6, {}, "result_summary-default"),
  createElement("attendance", 7, {}, "attendance-default"),
  createElement("remarks", 8, {}, "remarks-default"),
  createElement("signatures", 9, {}, "signatures-default"),
];

function defaultTemplatePayload(): Template {
  return {
    name: "New Report Card Template",
    description: "",
    class_id: null,
    academic_session_id: null,
    exam_id: null,
    page_size: "A4",
    orientation: "portrait",
    status: "ACTIVE",
    is_default: false,
    elements: DEFAULT_ELEMENTS.map((item) => ({
      ...item,
      style: { ...(item.style || {}) },
      props: { ...(item.props || {}) },
    })),
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  };
}

function normalizeTemplate(input: any): Template {
  const base = defaultTemplatePayload();

  const settings: BuilderSettings = {
    ...base.settings,
    ...(input?.settings || {}),
    page: {
      ...base.settings?.page,
      ...(input?.settings?.page || {}),
    },
    academic: {
      ...base.settings?.academic,
      ...(input?.settings?.academic || {}),
    },
    co_scholastic: {
      ...base.settings?.co_scholastic,
      ...(input?.settings?.co_scholastic || {}),
    },
    result: {
      ...base.settings?.result,
      ...(input?.settings?.result || {}),
    },
    attendance: {
      ...base.settings?.attendance,
      ...(input?.settings?.attendance || {}),
    },
    remarks: {
      ...base.settings?.remarks,
      ...(input?.settings?.remarks || {}),
    },
    signatures: {
      ...base.settings?.signatures,
      ...(input?.settings?.signatures || {}),
    },
    theme: {
      ...DEFAULT_THEME,
      ...(input?.settings?.theme || {}),
    },
    school: {
      ...base.settings?.school,
      ...(input?.settings?.school || {}),
    },
  };

  if (
    !settings.academic_subjects?.length &&
    settings.academic?.subjects?.length
  ) {
    settings.academic_subjects = settings.academic.subjects;
  }

  if (
    !settings.co_scholastic_subjects?.length &&
    settings.co_scholastic?.subjects?.length
  ) {
    settings.co_scholastic_subjects = settings.co_scholastic.subjects;
  }

  return {
    ...base,
    ...(input || {}),
    elements:
      Array.isArray(input?.elements) && input.elements.length
        ? input.elements.map((element: BuilderElement, index: number) => ({
            ...createElement(element.type || "custom_text", index),
            ...element,
            style: {
              ...((createElement(element.type || "custom_text", index).style ||
                {}) as Record<string, any>),
              ...(element.style || {}),
            },
            props: {
              ...((createElement(element.type || "custom_text", index).props ||
                {}) as Record<string, any>),
              ...(element.props || {}),
            },
          }))
        : DEFAULT_ELEMENTS,
    settings,
  };
}

function ReportCardTemplateBuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const templateId = searchParams.get("id");

  const [template, setTemplate] = useState<Template>(() =>
    defaultTemplatePayload()
  );

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [coComponents, setCoComponents] = useState<
    CoScholasticComponent[]
  >([]);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    DEFAULT_ELEMENTS[0]?.id || null
  );

  const [activePanel, setActivePanel] = useState<
    "elements" | "settings" | "subjects"
  >("elements");

  const [draggingPalette, setDraggingPalette] = useState<string | null>(null);
  const [draggingElementId, setDraggingElementId] = useState<string | null>(
    null
  );

  const [zoom, setZoom] = useState(0.82);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  const selectedElement = useMemo(
    () =>
      template.elements?.find(
        (element) => element.id === selectedElementId
      ) || null,
    [template.elements, selectedElementId]
  );

  const theme = {
    ...DEFAULT_THEME,
    ...(template.settings?.theme || {}),
  };

  const page = templatePageDimensions(
    normalizeReportCardTemplate({
      ...template,
      page_size: template.settings?.page?.size || template.page_size,
      orientation: template.settings?.page?.orientation || template.orientation,
    }),
  );
  const pageWidth = page.width;
  const pageHeight = page.height;

  useEffect(() => {
    loadBuilderData();
  }, []);

  useEffect(() => {
    if (!templateId) {
      setLoading(false);
      return;
    }

    loadTemplate(templateId);
  }, [templateId]);

  useEffect(() => {
    const classId = template.class_id;

    if (!classId) {
      setCoComponents([]);
      return;
    }

    loadCoComponents(classId);
  }, [template.class_id]);

  async function loadBuilderData() {
    try {
      const [classData, sessionData, examData] = await Promise.all([
        apiFetch("/classes/"),
        apiFetch("/academic-sessions/"),
        apiFetch("/exams/"),
      ]);

      setClasses(
        Array.isArray(classData)
          ? classData
          : Array.isArray(classData?.items)
          ? classData.items
          : []
      );

      setSessions(
        Array.isArray(sessionData)
          ? sessionData
          : Array.isArray(sessionData?.items)
          ? sessionData.items
          : []
      );

      setExams(
        Array.isArray(examData)
          ? examData
          : Array.isArray(examData?.items)
          ? examData.items
          : []
      );
    } catch (err: any) {
      setError(err?.message || "Failed to load builder data.");
    }
  }

  async function loadCoComponents(classId: number) {
    try {
      const data = await apiFetch(
        `/co-scholastic/components?class_id=${encodeURIComponent(
          classId
        )}&active_only=true`
      );

      setCoComponents(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : []
      );
    } catch {
      setCoComponents([]);
    }
  }

  async function loadTemplate(id: string) {
    try {
      setLoading(true);
      setError("");

      const data = await apiFetch(`/report-card-templates/${id}`);

      const normalized = normalizeTemplate(data);

      setTemplate(normalized);

      const first = normalized.elements?.[0];

      if (first) {
        setSelectedElementId(first.id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load template.");
    } finally {
      setLoading(false);
    }
  }

  function updateTemplate(patch: Partial<Template>) {
    setTemplate((current) => ({
      ...current,
      ...patch,
    }));
  }

  function updateSettings(
    patch: Partial<BuilderSettings>
  ) {
    setTemplate((current) => ({
      ...current,
      settings: {
        ...(current.settings || {}),
        ...patch,
      },
    }));
  }

  function updateTheme(patch: Partial<Theme>) {
    setTemplate((current) => ({
      ...current,
      settings: {
        ...(current.settings || {}),
        theme: {
          ...(current.settings?.theme || {}),
          ...patch,
        },
      },
    }));
  }

  function updateElement(
    id: string,
    patch: Partial<BuilderElement>
  ) {
    setTemplate((current) => ({
      ...current,
      elements: (current.elements || []).map((element) =>
        element.id === id
          ? {
              ...element,
              ...patch,
            }
          : element
      ),
    }));
  }

  function updateElementStyle(
    id: string,
    patch: Record<string, any>
  ) {
    setTemplate((current) => ({
      ...current,
      elements: (current.elements || []).map((element) =>
        element.id === id
          ? {
              ...element,
              style: {
                ...(element.style || {}),
                ...patch,
              },
            }
          : element
      ),
    }));
  }

  function updateElementProps(
    id: string,
    patch: Record<string, any>
  ) {
    setTemplate((current) => ({
      ...current,
      elements: (current.elements || []).map((element) =>
        element.id === id
          ? {
              ...element,
              props: {
                ...(element.props || {}),
                ...patch,
              },
            }
          : element
      ),
    }));
  }

  function addElement(type: string, x = 24, y = 24) {
    const index = template.elements?.length || 0;

    const element = createElement(type, index, {
      x,
      y,
      zIndex: index + 1,
    });

    setTemplate((current) => ({
      ...current,
      elements: [
        ...(current.elements || []),
        element,
      ],
    }));

    setSelectedElementId(element.id);
    setActivePanel("elements");
  }

  function duplicateElement(id: string) {
    const source = template.elements?.find(
      (element) => element.id === id
    );

    if (!source) return;

    const index = template.elements?.length || 0;

    const copy: BuilderElement = {
      ...source,
      id: `${source.type}-${Date.now()}-${index}`,
      x: source.x + 12,
      y: source.y + 12,
      zIndex: index + 1,
      style: {
        ...(source.style || {}),
      },
      props: {
        ...(source.props || {}),
      },
    };

    setTemplate((current) => ({
      ...current,
      elements: [
        ...(current.elements || []),
        copy,
      ],
    }));

    setSelectedElementId(copy.id);
  }

  function deleteElement(id: string) {
    setTemplate((current) => ({
      ...current,
      elements: (current.elements || []).filter(
        (element) => element.id !== id
      ),
    }));

    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  }

  function moveElement(
    id: string,
    x: number,
    y: number
  ) {
    updateElement(id, {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
    });
  }

  function handlePaletteDragStart(
    event: DragEvent<HTMLDivElement>,
    type: string
  ) {
    setDraggingPalette(type);
    event.dataTransfer.setData("text/plain", type);
    event.dataTransfer.effectAllowed = "copy";
  }

  function handlePaletteDragEnd() {
    setDraggingPalette(null);
  }

  function handleCanvasDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    const type =
      event.dataTransfer.getData("text/plain") ||
      draggingPalette;

    if (!type) return;

    const rect = event.currentTarget.getBoundingClientRect();

    const x =
      (event.clientX - rect.left) / zoom;

    const y =
      (event.clientY - rect.top) / zoom;

    addElement(type, Math.max(12, x - 40), Math.max(12, y - 20));

    setDraggingPalette(null);
  }

  function handleCanvasDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleElementDragStart(
    event: DragEvent<HTMLDivElement>,
    id: string
  ) {
    event.stopPropagation();

    const element = template.elements?.find(
      (item) => item.id === id
    );

    if (!element || element.locked) {
      event.preventDefault();
      return;
    }

    setDraggingElementId(id);

    event.dataTransfer.setData(
      "application/x-report-card-element",
      id
    );

    event.dataTransfer.effectAllowed = "move";
  }

  function handleElementDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    const id = event.dataTransfer.getData(
      "application/x-report-card-element"
    );

    if (!id) return;

    const rect = event.currentTarget.getBoundingClientRect();

    const x =
      (event.clientX - rect.left) / zoom;

    const y =
      (event.clientY - rect.top) / zoom;

    const element = template.elements?.find(
      (item) => item.id === id
    );

    if (!element) return;

    moveElement(
      id,
      x - element.width / 2,
      y - 16
    );

    setDraggingElementId(null);
  }

  function handleElementDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    if (name === "name") {
      updateTemplate({
        name: value,
      });
    }

    if (name === "description") {
      updateTemplate({
        description: value,
      });
    }
  }

  function updateAcademicSetting(
    patch: Partial<NonNullable<BuilderSettings["academic"]>>
  ) {
    updateSettings({
      academic: {
        ...(template.settings?.academic || {}),
        ...patch,
      },
    });
  }

  function updateCoScholasticSetting(
    patch: Partial<
      NonNullable<BuilderSettings["co_scholastic"]>
    >
  ) {
    updateSettings({
      co_scholastic: {
        ...(template.settings?.co_scholastic || {}),
        ...patch,
      },
    });
  }

  function updateResultSetting(
    patch: Partial<
      NonNullable<BuilderSettings["result"]>
    >
  ) {
    updateSettings({
      result: {
        ...(template.settings?.result || {}),
        ...patch,
      },
    });
  }

  function updateAttendanceSetting(
    patch: Partial<
      NonNullable<BuilderSettings["attendance"]>
    >
  ) {
    updateSettings({
      attendance: {
        ...(template.settings?.attendance || {}),
        ...patch,
      },
    });
  }

  function updateRemarksSetting(
    patch: Partial<
      NonNullable<BuilderSettings["remarks"]>
    >
  ) {
    updateSettings({
      remarks: {
        ...(template.settings?.remarks || {}),
        ...patch,
      },
    });
  }

  function updateSignatureSetting(
    patch: Partial<
      NonNullable<BuilderSettings["signatures"]>
    >
  ) {
    updateSettings({
      signatures: {
        ...(template.settings?.signatures || {}),
        ...patch,
      },
    });
  }

  function updateSchoolSetting(
    patch: Partial<
      NonNullable<BuilderSettings["school"]>
    >
  ) {
    updateSettings({
      school: {
        ...(template.settings?.school || {}),
        ...patch,
      },
    });
  }

  function toggleAcademicColumn(
    column: string
  ) {
    const current =
      template.settings?.academic?.columns || [];

    const exists = current.includes(column);

    updateAcademicSetting({
      columns: exists
        ? current.filter((item) => item !== column)
        : [...current, column],
    });
  }

  function toggleAcademicSubject(
    subjectId: number
  ) {
    const current =
      template.settings?.academic_subjects || [];

    const exists = current.some(
      (subject) =>
        Number(subject.subject_id) === Number(subjectId)
    );

    const next = exists
      ? current.filter(
          (subject) =>
            Number(subject.subject_id) !== Number(subjectId)
        )
      : [
          ...current,
          {
            subject_id: subjectId,
            enabled: true,
            display_order: current.length + 1,
          },
        ];

    updateSettings({
      academic_subjects: next,
      academic: {
        ...(template.settings?.academic || {}),
        subjects: next,
      },
    });
  }

  function toggleCoComponent(
    component: CoScholasticComponent
  ) {
    const current =
      template.settings?.co_scholastic_subjects || [];

    const exists = current.some(
      (item) =>
        Number(item.component_id) === Number(component.id)
    );

    const next = exists
      ? current.filter(
          (item) =>
            Number(item.component_id) !== Number(component.id)
        )
      : [
          ...current,
          {
            component_id: component.id,
            id: String(component.id),
            name: component.name,
            gradeBased: Boolean(component.grade_based),
            active: true,
          },
        ];

    updateSettings({
      co_scholastic_subjects: next,
      co_scholastic: {
        ...(template.settings?.co_scholastic || {}),
        subjects: next,
      },
    });
  }

  async function saveTemplate() {
    try {
      setSaving(true);
      setError("");
      setSavedMessage("");

      const payload = {
        name:
          template.name?.trim() ||
          "New Report Card Template",
        description: template.description || "",
        class_id: template.class_id || null,
        academic_session_id:
          template.academic_session_id || null,
        exam_id: template.exam_id || null,
        page_size: template.settings?.page?.size || template.page_size || "A4",
        orientation: template.settings?.page?.orientation || template.orientation || "portrait",
        status: template.status || "ACTIVE",
        is_default: Boolean(template.is_default),
        elements: template.elements || [],
        settings: {
          ...(template.settings || {}),
          page: {
            ...(template.settings?.page || {}),
            size: template.settings?.page?.size || template.page_size || "A4",
            orientation: template.settings?.page?.orientation || template.orientation || "portrait",
          },
        },
      };

      let data;

      if (template.id) {
        data = await apiFetch(
          `/report-card-templates/${template.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
      } else {
        data = await apiFetch(
          "/report-card-templates/",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
      }

      const normalized = normalizeTemplate(data);

      setTemplate(normalized);

      setSavedMessage("Template saved successfully.");

      if (!template.id && normalized.id) {
        router.replace(
          `/dashboard/report-cards/templates?id=${normalized.id}`
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to save template."
      );
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplate() {
    if (!template.id) {
      const duplicate = {
        ...template,
        id: undefined,
        name: `${template.name} Copy`,
      };

      setTemplate(normalizeTemplate(duplicate));
      setSavedMessage("Template duplicated locally. Save it to create a new template.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const data = await apiFetch(
        `/report-card-templates/${template.id}/duplicate`,
        {
          method: "POST",
        }
      );

      const normalized = normalizeTemplate(data);

      setTemplate(normalized);

      if (normalized.id) {
        router.replace(
          `/dashboard/report-cards/templates?id=${normalized.id}`
        );
      }

      setSavedMessage("Template duplicated successfully.");
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to duplicate template."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate() {
    if (!template.id) {
      router.push("/dashboard/report-cards/templates");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this template?"
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      await apiFetch(
        `/report-card-templates/${template.id}`,
        {
          method: "DELETE",
        }
      );

      router.push("/dashboard/report-cards/templates");
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to delete template."
      );
    } finally {
      setSaving(false);
    }
  }

  async function setAsDefault() {
    if (!template.id) {
      setTemplate((current) => ({
        ...current,
        is_default: true,
      }));
      return;
    }

    try {
      setSaving(true);
      setError("");

      const data = await apiFetch(
        `/report-card-templates/${template.id}/default`,
        {
          method: "POST",
        }
      );

      setTemplate(normalizeTemplate(data));

      setSavedMessage(
        "Template set as default successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to set default template."
      );
    } finally {
      setSaving(false);
    }
  }

  function resetToDefault() {
    const confirmed = window.confirm(
      "Current unsaved builder changes will be replaced with the default layout. Continue?"
    );

    if (!confirmed) return;

    const fresh = defaultTemplatePayload();

    setTemplate({
      ...fresh,
      name: template.name || fresh.name,
      description: template.description || "",
      class_id: template.class_id || null,
      academic_session_id:
        template.academic_session_id || null,
      exam_id: template.exam_id || null,
    });

    setSelectedElementId(
      fresh.elements?.[0]?.id || null
    );
  }

  function renderElementPreview(
    element: BuilderElement
  ) {
    const style: CSSProperties = {
      ...(element.style || {}),
      boxSizing: "border-box" as const,
    };

    switch (element.type) {
      case "school_header":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              ...style,
            }}
          >
            {template.settings?.school?.logoUrl ? (
              <img
                src={template.settings.school.logoUrl}
                alt="School Logo"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 54,
                  height: 54,
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 54,
                  height: 54,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: "#64748b",
                }}
              >
                LOGO
              </div>
            )}

            <div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  color: theme.primary,
                }}
              >
                {template.settings?.school?.name ||
                  "Wisdom Public School"}
              </div>

              <div
                style={{
                  fontSize: 10,
                  marginTop: 3,
                  color: theme.secondary,
                }}
              >
                {template.settings?.school?.tagline ||
                  "Excellence in Education"}
              </div>

              <div
                style={{
                  fontSize: 8,
                  marginTop: 4,
                  color: theme.muted,
                }}
              >
                {template.settings?.school?.address ||
                  "School Address"}
              </div>
            </div>
          </div>
        );

      case "report_title":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent:
                style.textAlign === "left"
                  ? "flex-start"
                  : style.textAlign === "right"
                  ? "flex-end"
                  : "center",
              ...style,
            }}
          >
            {element.props?.text ||
              "ACADEMIC REPORT CARD"}
          </div>
        );

      case "result_date":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              ...style,
            }}
          >
            {element.props?.label ||
              "Result Declaration Date"}{" "}
            : 31 March 2026
          </div>
        );

      case "student_details":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
              overflow: "hidden",
              borderRadius:
                Number(style.borderRadius || 0),
              ...style,
            }}
          >
            {[
              ["Student Name", "Rahul Sharma"],
              ["Father's Name", "Mr. Rajesh Sharma"],
              ["Mother's Name", "Mrs. Sunita Sharma"],
              ["Class", "Class 5"],
              ["Section", "A"],
              ["Roll No.", "12"],
              ["Admission No.", "ADM-0012"],
              ["DOB", "15/08/2015"],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "5px 7px",
                  borderBottom:
                    "1px solid #e2e8f0",
                  fontSize: 8,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    minWidth: 76,
                    color: theme.secondary,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    color: theme.text,
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        );

      case "academic_table":
        return (
          <AcademicPreview
            settings={template.settings}
            theme={theme}
          />
        );

      case "co_scholastic":
        return (
          <CoScholasticPreview
            settings={template.settings}
            theme={theme}
          />
        );

      case "result_summary":
        return (
          <ResultSummaryPreview
            settings={template.settings}
            theme={theme}
          />
        );

      case "attendance":
        return (
          <AttendancePreview
            settings={template.settings}
            theme={theme}
          />
        );

      case "remarks":
        return (
          <RemarksPreview
            settings={template.settings}
            theme={theme}
          />
        );

      case "signatures":
        return (
          <SignaturesPreview
            settings={template.settings}
            theme={theme}
          />
        );

      case "logo":
        return template.settings?.school?.logoUrl ? (
          <img
            src={template.settings.school.logoUrl}
            alt="Logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              ...style,
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed #94a3b8",
              color: "#64748b",
              fontSize: 10,
              ...style,
            }}
          >
            School Logo
          </div>
        );

      case "section_heading":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              ...style,
            }}
          >
            {element.props?.text ||
              "Section Heading"}
          </div>
        );

      case "custom_text":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              whiteSpace: "pre-wrap",
              ...style,
            }}
          >
            {element.props?.text ||
              "Custom text"}
          </div>
        );

      case "divider":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                style.backgroundColor ||
                theme.border ||
                "#cbd5e1",
            }}
          />
        );

      default:
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: 8,
              fontSize: 10,
              color: theme.muted,
              border: "1px dashed #cbd5e1",
            }}
          >
            {element.type}
          </div>
        );
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">
            Template load ho raha hai...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-100 text-slate-900"
      style={{
        fontFamily:
          theme.fontFamily ||
          "Arial, Helvetica, sans-serif",
      }}
    >
      <style>{`@page { size: ${template.settings?.page?.size || template.page_size || "A4"} ${template.settings?.page?.orientation || template.orientation || "portrait"}; margin: 0; } @media print { body * { visibility: hidden !important; } #report-card-builder-sheet, #report-card-builder-sheet * { visibility: visible !important; } #report-card-builder-sheet { position: absolute !important; left: 0 !important; top: 0 !important; box-shadow: none !important; transform: none !important; } }`}</style>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex h-16 items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/report-cards/templates"
                )
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              ← Templates
            </button>

            <div className="min-w-0">
              <div className="truncate text-sm font-bold">
                Template Builder
              </div>
              <div className="truncate text-xs text-slate-500">
                A4 Report Card Designer
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setZoom((value) =>
                  Math.max(
                    0.5,
                    Number((value - 0.05).toFixed(2))
                  )
                )
              }
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold"
            >
              −
            </button>

            <span className="min-w-[52px] text-center text-xs font-semibold text-slate-600">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() =>
                setZoom((value) =>
                  Math.min(
                    1.25,
                    Number((value + 0.05).toFixed(2))
                  )
                )
              }
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold"
            >
              +
            </button>

            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              {showPreview
                ? "Hide Preview"
              : "Show Preview"}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              Print / PDF
            </button>

            <button
              type="button"
              onClick={resetToDefault}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={duplicateTemplate}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Duplicate
            </button>

            <button
              type="button"
              onClick={setAsDefault}
              disabled={saving}
              className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              Set Default
            </button>

            {template.id && (
              <button
                type="button"
                onClick={deleteTemplate}
                disabled={saving}
                className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            )}

            <button
              type="button"
              onClick={saveTemplate}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Template"}
            </button>
          </div>
        </div>
      </header>

      {(error || savedMessage) && (
        <div className="px-5 pt-4">
          {error && (
            <div className="mx-auto max-w-[1600px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && savedMessage && (
            <div className="mx-auto max-w-[1600px] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {savedMessage}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-[calc(100vh-64px)]">
        <aside className="w-[285px] shrink-0 border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Template
            </div>

            <input
              name="name"
              value={template.name || ""}
              onChange={handleInputChange}
              placeholder="Template name"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <textarea
              name="description"
              value={template.description || ""}
              onChange={handleInputChange}
              placeholder="Description"
              rows={2}
              className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                value={template.class_id ?? ""}
                onChange={(event) =>
                  updateTemplate({
                    class_id: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                className="rounded-xl border border-slate-300 px-2 py-2 text-xs"
              >
                <option value="">
                  All Classes
                </option>
                {classes.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name ||
                      item.class_name ||
                      `Class ${item.id}`}
                  </option>
                ))}
              </select>

              <select
                value={
                  template.academic_session_id ?? ""
                }
                onChange={(event) =>
                  updateTemplate({
                    academic_session_id:
                      event.target.value
                        ? Number(event.target.value)
                        : null,
                  })
                }
                className="rounded-xl border border-slate-300 px-2 py-2 text-xs"
              >
                <option value="">
                  Session
                </option>
                {sessions.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name ||
                      item.session_name ||
                      item.academic_year ||
                      `Session ${item.id}`}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={template.exam_id ?? ""}
              onChange={(event) =>
                updateTemplate({
                  exam_id: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 px-2 py-2 text-xs"
            >
              <option value="">
                Exam
              </option>
              {exams.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name ||
                    item.exam_name ||
                    `Exam ${item.id}`}
                </option>
              ))}
            </select>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(template.is_default)}
                onChange={(event) =>
                  updateTemplate({
                    is_default: event.target.checked,
                  })
                }
              />
              Default template
            </label>
          </div>

          <div className="grid grid-cols-3 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActivePanel("elements")}
              className={`px-2 py-3 text-xs font-bold ${
                activePanel === "elements"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500"
              }`}
            >
              Elements
            </button>

            <button
              type="button"
              onClick={() => setActivePanel("settings")}
              className={`px-2 py-3 text-xs font-bold ${
                activePanel === "settings"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500"
              }`}
            >
              Settings
            </button>

            <button
              type="button"
              onClick={() => setActivePanel("subjects")}
              className={`px-2 py-3 text-xs font-bold ${
                activePanel === "subjects"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500"
              }`}
            >
              Data
            </button>
          </div>

          <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-3">
            {activePanel === "elements" && (
              <div className="space-y-2">
                <div className="mb-3 text-xs text-slate-500">
                  Elements ko canvas par drag karke add karein.
                </div>

                {PALETTE.map((item) => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(event) =>
                      handlePaletteDragStart(
                        event,
                        item.type
                      )
                    }
                    onDragEnd={handlePaletteDragEnd}
                    onDoubleClick={() =>
                      addElement(item.type)
                    }
                    className={`cursor-grab rounded-xl border bg-white p-3 transition hover:border-blue-400 hover:bg-blue-50 ${
                      draggingPalette === item.type
                        ? "border-blue-500 bg-blue-50 opacity-60"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                        {item.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-bold">
                          {item.label}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-4 text-slate-500">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activePanel === "settings" && (
              <BuilderSettingsPanel
                settings={template.settings || DEFAULT_SETTINGS}
                theme={theme}
                updateSettings={updateSettings}
                updateTheme={updateTheme}
                updateAcademicSetting={
                  updateAcademicSetting
                }
                updateCoScholasticSetting={
                  updateCoScholasticSetting
                }
                updateResultSetting={
                  updateResultSetting
                }
                updateAttendanceSetting={
                  updateAttendanceSetting
                }
                updateRemarksSetting={
                  updateRemarksSetting
                }
                updateSignatureSetting={
                  updateSignatureSetting
                }
                updateSchoolSetting={
                  updateSchoolSetting
                }
                toggleAcademicColumn={
                  toggleAcademicColumn
                }
              />
            )}

            {activePanel === "subjects" && (
              <DataSettingsPanel
                template={template}
                classes={classes}
                sessions={sessions}
                exams={exams}
                coComponents={coComponents}
                toggleAcademicSubject={
                  toggleAcademicSubject
                }
                toggleCoComponent={
                  toggleCoComponent
                }
              />
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto bg-slate-200">
          <div className="flex min-h-full items-start justify-center p-10">
            {showPreview ? (
              <div
                className="origin-top-left shadow-2xl"
                style={{
                  width: pageWidth,
                  height: pageHeight,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  marginRight:
                    pageWidth * (zoom - 1),
                  marginBottom:
                    pageHeight * (zoom - 1),
                }}
              >
                <div
                  id="report-card-builder-sheet"
                  className="relative overflow-hidden bg-white"
                  style={{
                    width: pageWidth,
                    height: pageHeight,
                    fontFamily:
                      theme.fontFamily ||
                      "Arial, Helvetica, sans-serif",
                  }}
                  onDrop={handleCanvasDrop}
                  onDragOver={handleCanvasDragOver}
                >
                  {(template.elements || [])
                    .filter(
                      (element) =>
                        element.visible !== false
                    )
                    .sort(
                      (a, b) =>
                        Number(a.zIndex || 0) -
                        Number(b.zIndex || 0)
                    )
                    .map((element) => {
                      const isSelected =
                        selectedElementId ===
                        element.id;

                      const elementStyle: CSSProperties =
                        {
                          position: "absolute",
                          left: element.x,
                          top: element.y,
                          width: element.width,
                          height: element.height,
                          zIndex:
                            element.zIndex || 1,
                          cursor:
                            element.locked
                              ? "default"
                              : "move",
                          outline: isSelected
                            ? "2px solid #2563eb"
                            : "none",
                          outlineOffset: 2,
                          opacity:
                            draggingElementId ===
                            element.id
                              ? 0.55
                              : 1,
                        };

                      return (
                        <div
                          key={element.id}
                          draggable={
                            !element.locked
                          }
                          onDragStart={(event) =>
                            handleElementDragStart(
                              event,
                              element.id
                            )
                          }
                          onDragEnd={() =>
                            setDraggingElementId(
                              null
                            )
                          }
                          onDragOver={
                            handleElementDragOver
                          }
                          onDrop={
                            handleElementDrop
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedElementId(
                              element.id
                            );
                            setActivePanel(
                              "elements"
                            );
                          }}
                          style={elementStyle}
                        >
                          <ReportCardElementRenderer template={template} element={element} />

                          {isSelected && (
                            <div className="pointer-events-none absolute -right-1 -top-1 flex gap-1">
                              <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[8px] font-bold text-white">
                                {element.type}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {!template.elements?.length && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                      Drag elements here to start designing.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[720px] w-full max-w-5xl items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white">
                <div className="text-center">
                  <div className="text-4xl">
                    📄
                  </div>
                  <div className="mt-3 font-bold">
                    Preview hidden
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setShowPreview(true)
                    }
                    className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    Show Preview
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className="w-[310px] shrink-0 border-l border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Selected Element
            </div>
          </div>

          {!selectedElement ? (
            <div className="p-5 text-sm text-slate-500">
              Canvas par kisi element ko select karein.
            </div>
          ) : (
            <ElementPropertiesPanel
              element={selectedElement}
              updateElement={
                (patch) =>
                  updateElement(
                    selectedElement.id,
                    patch
                  )
              }
              updateStyle={(patch) =>
                updateElementStyle(
                  selectedElement.id,
                  patch
                )
              }
              updateProps={(patch) =>
                updateElementProps(
                  selectedElement.id,
                  patch
                )
              }
              duplicate={() =>
                duplicateElement(
                  selectedElement.id
                )
              }
              remove={() =>
                deleteElement(
                  selectedElement.id
                )
              }
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function BuilderSettingsPanel({
  settings,
  theme,
  updateSettings,
  updateTheme,
  updateAcademicSetting,
  updateCoScholasticSetting,
  updateResultSetting,
  updateAttendanceSetting,
  updateRemarksSetting,
  updateSignatureSetting,
  updateSchoolSetting,
  toggleAcademicColumn,
}: {
  settings: BuilderSettings;
  theme: Theme;
  updateSettings: (
    patch: Partial<BuilderSettings>
  ) => void;
  updateTheme: (patch: Partial<Theme>) => void;
  updateAcademicSetting: (
    patch: Partial<
      NonNullable<BuilderSettings["academic"]>
    >
  ) => void;
  updateCoScholasticSetting: (
    patch: Partial<
      NonNullable<BuilderSettings["co_scholastic"]>
    >
  ) => void;
  updateResultSetting: (
    patch: Partial<
      NonNullable<BuilderSettings["result"]>
    >
  ) => void;
  updateAttendanceSetting: (
    patch: Partial<
      NonNullable<BuilderSettings["attendance"]>
    >
  ) => void;
  updateRemarksSetting: (
    patch: Partial<
      NonNullable<BuilderSettings["remarks"]>
    >
  ) => void;
  updateSignatureSetting: (
    patch: Partial<
      NonNullable<BuilderSettings["signatures"]>
    >
  ) => void;
  updateSchoolSetting: (
    patch: Partial<
      NonNullable<BuilderSettings["school"]>
    >
  ) => void;
  toggleAcademicColumn: (
    column: string
  ) => void;
}) {
  const academic =
    settings.academic || {};
  const co =
    settings.co_scholastic || {};
  const result =
    settings.result || {};
  const attendance =
    settings.attendance || {};
  const remarks =
    settings.remarks || {};
  const signatures =
    settings.signatures || {};
  const school =
    settings.school || {};

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Page
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Size
              </span>
              <select
                value={
                  settings.page?.size ||
                  "A4"
                }
                onChange={(event) =>
                  updateSettings({
                    page: {
                      ...(settings.page || {}),
                      size: event.target.value,
                    },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              >
                <option value="A4">
                  A4
                </option>
              </select>
            </label>

            <label className="text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Orientation
              </span>
              <select
                value={
                  settings.page?.orientation ||
                  "portrait"
                }
                onChange={(event) =>
                  updateSettings({
                    page: {
                      ...(settings.page || {}),
                      orientation:
                        event.target.value,
                    },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              >
                <option value="portrait">
                  Portrait
                </option>
                <option value="landscape">
                  Landscape
                </option>
              </select>
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["marginTop", "Top"],
              ["marginRight", "Right"],
              ["marginBottom", "Bottom"],
              ["marginLeft", "Left"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="text-xs"
              >
                <span className="mb-1 block font-semibold text-slate-600">
                  {label}
                </span>
                <input
                  type="number"
                  value={
                    Number(
                      settings.page?.[
                        key as keyof NonNullable<
                          BuilderSettings["page"]
                        >
                      ] || 0
                    )
                  }
                  onChange={(event) =>
                    updateSettings({
                      page: {
                        ...(settings.page || {}),
                        [key]: Number(
                          event.target.value
                        ),
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2 py-2"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionLabel title="School" />

        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          {[
            ["name", "School Name"],
            ["tagline", "Tagline"],
            ["address", "Address"],
            ["phone", "Phone"],
            ["email", "Email"],
            ["website", "Website"],
            ["logoUrl", "Logo URL"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="block text-xs"
            >
              <span className="mb-1 block font-semibold text-slate-600">
                {label}
              </span>

              <input
                value={
                  String(
                    school[
                      key as keyof typeof school
                    ] || ""
                  )
                }
                onChange={(event) =>
                  updateSchoolSetting({
                    [key]:
                      event.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel title="Academic" />

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <Toggle
            label="Enable Academic"
            checked={
              academic.enabled !== false
            }
            onChange={(checked) =>
              updateAcademicSetting({
                enabled: checked,
              })
            }
          />

          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-600">
              Section Title
            </span>
            <input
              value={
                academic.title ||
                "Academic Performance"
              }
              onChange={(event) =>
                updateAcademicSetting({
                  title:
                    event.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
            />
          </label>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Columns
            </div>

            {[
              ["max_marks", "Max Marks"],
              ["pass_marks", "Pass Marks"],
              ["obtained", "Obtained"],
              ["grade", "Grade"],
              ["remark", "Remark"],
            ].map(([key, label]) => (
              <Toggle
                key={key}
                label={label}
                checked={Boolean(
                  academic.columns?.includes(
                    key
                  )
                )}
                onChange={() =>
                  toggleAcademicColumn(
                    key
                  )
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionLabel title="Co-Scholastic" />

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <Toggle
            label="Enable Co-Scholastic"
            checked={
              co.enabled !== false
            }
            onChange={(checked) =>
              updateCoScholasticSetting({
                enabled: checked,
              })
            }
          />

          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-600">
              Section Title
            </span>
            <input
              value={
                co.title ||
                "Co-Scholastic Activities"
              }
              onChange={(event) =>
                updateCoScholasticSetting({
                  title:
                    event.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
            />
          </label>

          <Toggle
            label="Show Grade"
            checked={
              co.showGrade !== false
            }
            onChange={(checked) =>
              updateCoScholasticSetting({
                showGrade: checked,
              })
            }
          />

          <Toggle
            label="Show Remark"
            checked={
              co.showRemark !== false
            }
            onChange={(checked) =>
              updateCoScholasticSetting({
                showRemark: checked,
              })
            }
          />
        </div>
      </section>

      <section>
        <SectionLabel title="Result Summary" />

        <div className="space-y-1.5 rounded-xl border border-slate-200 p-3">
          <Toggle
            label="Enable Result Summary"
            checked={
              result.enabled !== false
            }
            onChange={(checked) =>
              updateResultSetting({
                enabled: checked,
              })
            }
          />

          {[
            ["showTotal", "Total"],
            ["showPercentage", "Percentage"],
            ["showGrade", "Grade"],
            ["showDivision", "Division"],
            ["showResult", "Result"],
            ["showRank", "Rank"],
          ].map(([key, label]) => (
            <Toggle
              key={key}
              label={label}
              checked={
                result[
                  key as keyof typeof result
                ] !== false
              }
              onChange={(checked) =>
                updateResultSetting({
                  [key]: checked,
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel title="Attendance" />

        <div className="space-y-1.5 rounded-xl border border-slate-200 p-3">
          <Toggle
            label="Enable Attendance"
            checked={
              attendance.enabled !== false
            }
            onChange={(checked) =>
              updateAttendanceSetting({
                enabled: checked,
              })
            }
          />

          {[
            ["showWorkingDays", "Working Days"],
            ["showPresentDays", "Present Days"],
            ["showPercentage", "Percentage"],
          ].map(([key, label]) => (
            <Toggle
              key={key}
              label={label}
              checked={
                attendance[
                  key as keyof typeof attendance
                ] !== false
              }
              onChange={(checked) =>
                updateAttendanceSetting({
                  [key]: checked,
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel title="Remarks" />

        <div className="space-y-1.5 rounded-xl border border-slate-200 p-3">
          <Toggle
            label="Enable Remarks"
            checked={
              remarks.enabled !== false
            }
            onChange={(checked) =>
              updateRemarksSetting({
                enabled: checked,
              })
            }
          />

          <Toggle
            label="Class Teacher"
            checked={
              remarks.classTeacher !== false
            }
            onChange={(checked) =>
              updateRemarksSetting({
                classTeacher: checked,
              })
            }
          />

          <Toggle
            label="Principal"
            checked={
              remarks.principal !== false
            }
            onChange={(checked) =>
              updateRemarksSetting({
                principal: checked,
              })
            }
          />
        </div>
      </section>

      <section>
        <SectionLabel title="Signatures" />

        <div className="space-y-1.5 rounded-xl border border-slate-200 p-3">
          <Toggle
            label="Enable Signatures"
            checked={
              signatures.enabled !== false
            }
            onChange={(checked) =>
              updateSignatureSetting({
                enabled: checked,
              })
            }
          />

          {[
            ["classTeacher", "Class Teacher"],
            ["principal", "Principal"],
            ["parent", "Parent"],
          ].map(([key, label]) => (
            <Toggle
              key={key}
              label={label}
              checked={
                signatures[
                  key as keyof typeof signatures
                ] !== false
              }
              onChange={(checked) =>
                updateSignatureSetting({
                  [key]: checked,
                })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel title="Theme" />

        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          {[
            ["primary", "Primary"],
            ["secondary", "Secondary"],
            ["accent", "Accent"],
            ["gold", "Gold"],
            ["headerBg", "Header Background"],
            ["tableHeader", "Table Header"],
            ["softBg", "Soft Background"],
            ["border", "Border"],
            ["text", "Text"],
            ["muted", "Muted"],
            ["success", "Success"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="font-semibold text-slate-600">
                {label}
              </span>

              <input
                type="color"
                value={
                  String(
                    theme[
                      key as keyof Theme
                    ] || "#000000"
                  )
                }
                onChange={(event) =>
                  updateTheme({
                    [key]:
                      event.target.value,
                  })
                }
                className="h-8 w-12 cursor-pointer rounded border border-slate-300 bg-white"
              />
            </label>
          ))}

          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-600">
              Font Family
            </span>

            <select
              value={
                theme.fontFamily ||
                DEFAULT_THEME.fontFamily
              }
              onChange={(event) =>
                updateTheme({
                  fontFamily:
                    event.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 px-2 py-2"
            >
              <option value="Arial, Helvetica, sans-serif">
                Arial
              </option>
              <option value="Georgia, serif">
                Georgia
              </option>
              <option value="'Times New Roman', serif">
                Times New Roman
              </option>
              <option value="Verdana, sans-serif">
                Verdana
              </option>
              <option value="'Trebuchet MS', sans-serif">
                Trebuchet MS
              </option>
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-600">
              Border Radius
            </span>

            <input
              type="number"
              min={0}
              max={30}
              value={
                Number(
                  theme.borderRadius || 0
                )
              }
              onChange={(event) =>
                updateTheme({
                  borderRadius:
                    Number(
                      event.target.value
                    ),
                })
              }
              className="w-full rounded-lg border border-slate-300 px-2 py-2"
            />
          </label>
        </div>
      </section>

      <section>
        <SectionLabel title="Placeholders" />

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-[10px] leading-4 text-slate-500">
            Custom Text ya supported text fields mein in placeholders ka use kar sakte hain.
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map(
              (placeholder) => (
                <span
                  key={placeholder}
                  className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[9px] text-slate-600"
                >
                  {placeholder}
                </span>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function DataSettingsPanel({
  template,
  classes,
  sessions,
  exams,
  coComponents,
  toggleAcademicSubject,
  toggleCoComponent,
}: {
  template: Template;
  classes: ClassItem[];
  sessions: SessionItem[];
  exams: ExamItem[];
  coComponents: CoScholasticComponent[];
  toggleAcademicSubject: (
    subjectId: number
  ) => void;
  toggleCoComponent: (
    component: CoScholasticComponent
  ) => void;
}) {
  const academicSubjects =
    template.settings?.academic_subjects ||
    template.settings?.academic?.subjects ||
    [];

  const selectedCo =
    template.settings?.co_scholastic_subjects ||
    template.settings?.co_scholastic?.subjects ||
    [];

  return (
    <div className="space-y-5">
      <section>
        <SectionLabel title="Template Mapping" />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          Template ko Class, Session aur Exam ke saath map kar sakte ho. Report Card generation ke time isi saved template ko use kiya ja sakta hai.
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] text-slate-500">
            Selected Class
          </div>
          <div className="mt-1 text-sm font-bold">
            {classes.find(
              (item) =>
                Number(item.id) ===
                Number(template.class_id)
            )?.name ||
              classes.find(
                (item) =>
                  Number(item.id) ===
                  Number(template.class_id)
              )?.class_name ||
              (template.class_id
                ? `Class ${template.class_id}`
                : "All Classes")}
          </div>

          <div className="mt-3 text-[10px] text-slate-500">
            Academic Session
          </div>
          <div className="mt-1 text-sm font-bold">
            {sessions.find(
              (item) =>
                Number(item.id) ===
                Number(
                  template.academic_session_id
                )
            )?.name ||
              sessions.find(
                (item) =>
                  Number(item.id) ===
                  Number(
                    template.academic_session_id
                  )
              )?.session_name ||
              (template.academic_session_id
                ? `Session ${template.academic_session_id}`
                : "Any Session")}
          </div>

          <div className="mt-3 text-[10px] text-slate-500">
            Exam
          </div>
          <div className="mt-1 text-sm font-bold">
            {exams.find(
              (item) =>
                Number(item.id) ===
                Number(template.exam_id)
            )?.name ||
              exams.find(
                (item) =>
                  Number(item.id) ===
                  Number(template.exam_id)
              )?.exam_name ||
              (template.exam_id
                ? `Exam ${template.exam_id}`
                : "Any Exam")}
          </div>
        </div>
      </section>

      <section>
        <SectionLabel title="Academic Subjects" />

        {!template.class_id ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
            Specific class select karne par academic subjects yahan configure kiye ja sakte hain.
          </div>
        ) : (
          <div className="space-y-2">
            {academicSubjects.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-500">
                Exam/Class subject configuration se subjects available hone par yahan list aayegi.
              </div>
            ) : (
              academicSubjects.map(
                (subject, index) => (
                  <div
                    key={
                      subject.subject_id ||
                      index
                    }
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold">
                          {subject.name ||
                            `Subject ${
                              subject.subject_id
                            }`}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {subject.code ||
                            ""}
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">
                        Selected
                      </span>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        )}
      </section>

      <section>
        <SectionLabel title="Co-Scholastic Components" />

        {!template.class_id ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
            Class select karo, phir actual Co-Scholastic components yahan se select karo.
          </div>
        ) : coComponents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-500">
            Is class ke liye active Co-Scholastic components nahi mile.
          </div>
        ) : (
          <div className="space-y-2">
            {coComponents.map(
              (component) => {
                const checked =
                  selectedCo.some(
                    (item) =>
                      Number(
                        item.component_id
                      ) ===
                      Number(
                        component.id
                      )
                  );

                return (
                  <label
                    key={component.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                      checked
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        toggleCoComponent(
                          component
                        )
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold">
                        {component.name}
                      </div>

                      <div className="text-[10px] text-slate-500">
                        {component.grade_based
                          ? "Grade based"
                          : "Marks / value based"}
                      </div>
                    </div>
                  </label>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ElementPropertiesPanel({
  element,
  updateElement,
  updateStyle,
  updateProps,
  duplicate,
  remove,
}: {
  element: BuilderElement;
  updateElement: (
    patch: Partial<BuilderElement>
  ) => void;
  updateStyle: (
    patch: Record<string, any>
  ) => void;
  updateProps: (
    patch: Record<string, any>
  ) => void;
  duplicate: () => void;
  remove: () => void;
}) {
  return (
    <div className="max-h-[calc(100vh-110px)] overflow-y-auto p-4">
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="text-xs font-bold">
          {element.type}
        </div>

        <div className="mt-1 text-[10px] text-slate-500">
          ID: {element.id}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <section>
          <SectionLabel title="Position & Size" />

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3">
            {[
              ["x", "X"],
              ["y", "Y"],
              ["width", "Width"],
              ["height", "Height"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="text-xs"
              >
                <span className="mb-1 block font-semibold text-slate-600">
                  {label}
                </span>

                <input
                  type="number"
                  value={Number(
                    element[
                      key as keyof BuilderElement
                    ] || 0
                  )}
                  onChange={(event) =>
                    updateElement({
                      [key]:
                        Number(
                          event.target.value
                        ),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2 py-2"
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel title="Layer" />

          <div className="rounded-xl border border-slate-200 p-3">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Z Index
              </span>

              <input
                type="number"
                value={Number(
                  element.zIndex || 0
                )}
                onChange={(event) =>
                  updateElement({
                    zIndex:
                      Number(
                        event.target.value
                      ),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              />
            </label>

            <div className="mt-3 space-y-1.5">
              <Toggle
                label="Visible"
                checked={
                  element.visible !== false
                }
                onChange={(checked) =>
                  updateElement({
                    visible: checked,
                  })
                }
              />

              <Toggle
                label="Locked"
                checked={Boolean(
                  element.locked
                )}
                onChange={(checked) =>
                  updateElement({
                    locked: checked,
                  })
                }
              />
            </div>
          </div>
        </section>

        <section>
          <SectionLabel title="Style" />

          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Font Size
              </span>

              <input
                type="number"
                value={Number(
                  element.style
                    ?.fontSize || 10
                )}
                onChange={(event) =>
                  updateStyle({
                    fontSize:
                      Number(
                        event.target.value
                      ),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Font Weight
              </span>

              <select
                value={String(
                  element.style
                    ?.fontWeight || 400
                )}
                onChange={(event) =>
                  updateStyle({
                    fontWeight:
                      Number(
                        event.target.value
                      ),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              >
                <option value="400">
                  Normal
                </option>
                <option value="500">
                  Medium
                </option>
                <option value="600">
                  Semi Bold
                </option>
                <option value="700">
                  Bold
                </option>
                <option value="800">
                  Extra Bold
                </option>
              </select>
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Text Align
              </span>

              <select
                value={String(
                  element.style
                    ?.textAlign || "left"
                )}
                onChange={(event) =>
                  updateStyle({
                    textAlign:
                      event.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              >
                <option value="left">
                  Left
                </option>
                <option value="center">
                  Center
                </option>
                <option value="right">
                  Right
                </option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <span className="mb-1 block font-semibold text-slate-600">
                  Text
                </span>
                <input
                  type="color"
                  value={String(
                    element.style
                      ?.color || "#0f172a"
                  )}
                  onChange={(event) =>
                    updateStyle({
                      color:
                        event.target.value,
                    })
                  }
                  className="h-9 w-full cursor-pointer rounded border border-slate-300"
                />
              </label>

              <label className="text-xs">
                <span className="mb-1 block font-semibold text-slate-600">
                  Background
                </span>
                <input
                  type="color"
                  value={String(
                    element.style
                      ?.backgroundColor ||
                      "#ffffff"
                  )}
                  onChange={(event) =>
                    updateStyle({
                      backgroundColor:
                        event.target.value,
                    })
                  }
                  className="h-9 w-full cursor-pointer rounded border border-slate-300"
                />
              </label>
            </div>

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Border Width
              </span>

              <input
                type="number"
                min={0}
                value={Number(
                  element.style
                    ?.borderWidth || 0
                )}
                onChange={(event) =>
                  updateStyle({
                    borderWidth:
                      Number(
                        event.target.value
                      ),
                    borderStyle:
                      Number(
                        event.target.value
                      ) > 0
                        ? "solid"
                        : "none",
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Border Color
              </span>

              <input
                type="color"
                value={String(
                  element.style
                    ?.borderColor ||
                    "#cbd5e1"
                )}
                onChange={(event) =>
                  updateStyle({
                    borderColor:
                      event.target.value,
                  })
                }
                className="h-9 w-full cursor-pointer rounded border border-slate-300"
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Border Radius
              </span>

              <input
                type="number"
                min={0}
                value={Number(
                  element.style
                    ?.borderRadius || 0
                )}
                onChange={(event) =>
                  updateStyle({
                    borderRadius:
                      Number(
                        event.target.value
                      ),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Padding
              </span>

              <input
                type="number"
                min={0}
                value={Number(
                  element.style
                    ?.padding || 0
                )}
                onChange={(event) =>
                  updateStyle({
                    padding:
                      Number(
                        event.target.value
                      ),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              />
            </label>
          </div>
        </section>

        {[
          "report_title",
          "section_heading",
          "custom_text",
        ].includes(element.type) && (
          <section>
            <SectionLabel title="Text" />

            <textarea
              value={String(
                element.props?.text || ""
              )}
              onChange={(event) =>
                updateProps({
                  text:
                    event.target.value,
                })
              }
              rows={5}
              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />

            <div className="mt-2 text-[10px] text-slate-500">
              Placeholders:
            </div>

            <div className="mt-1 flex flex-wrap gap-1">
              {PLACEHOLDERS.slice(
                0,
                10
              ).map((placeholder) => (
                <button
                  key={placeholder}
                  type="button"
                  onClick={() =>
                    updateProps({
                      text: `${String(
                        element.props
                          ?.text || ""
                      )}${placeholder}`,
                    })
                  }
                  className="rounded bg-slate-100 px-1.5 py-1 font-mono text-[8px] hover:bg-blue-50"
                >
                  {placeholder}
                </button>
              ))}
            </div>
          </section>
        )}

        {element.type === "logo" && (
          <section>
            <SectionLabel title="Image" />

            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Image URL
              </span>

              <input
                value={String(
                  element.props?.src || ""
                )}
                onChange={(event) =>
                  updateProps({
                    src:
                      event.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
                placeholder="https://..."
              />
            </label>

            <label className="mt-2 block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">
                Object Fit
              </span>

              <select
                value={String(
                  element.style
                    ?.objectFit ||
                    "contain"
                )}
                onChange={(event) =>
                  updateStyle({
                    objectFit:
                      event.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-2"
              >
                <option value="contain">
                  Contain
                </option>
                <option value="cover">
                  Cover
                </option>
                <option value="fill">
                  Fill
                </option>
              </select>
            </label>
          </section>
        )}

        <section>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={duplicate}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Duplicate
            </button>

            <button
              type="button"
              onClick={remove}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function AcademicPreview({
  settings,
  theme,
}: {
  settings?: BuilderSettings;
  theme: Theme;
}) {
  const academic =
    settings?.academic || {};

  if (academic.enabled === false) {
    return null;
  }

  const columns =
    academic.columns || [
      "subject",
      "max_marks",
      "pass_marks",
      "obtained",
      "grade",
      "remark",
    ];

  const rows = [
    ["English", "100", "40", "86", "A", "Excellent"],
    ["Hindi", "100", "40", "79", "B+", "Very Good"],
    ["Mathematics", "100", "40", "92", "A+", "Outstanding"],
    ["Science", "100", "40", "88", "A", "Excellent"],
    ["Social Science", "100", "40", "81", "A", "Excellent"],
  ];

  return (
    <div className="h-full w-full overflow-hidden">
      <div
        className="border-b px-2 py-1.5 text-[10px] font-bold"
        style={{
          background:
            theme.headerBg ||
            "#f8fafc",
          color:
            theme.text ||
            "#0f172a",
          borderColor:
            theme.border ||
            "#cbd5e1",
        }}
      >
        {academic.title ||
          "Academic Performance"}
      </div>

      <table
        className="w-full border-collapse text-[8px]"
        style={{
          color:
            theme.text ||
            "#0f172a",
        }}
      >
        <thead>
          <tr
            style={{
              background:
                theme.tableHeader ||
                "#e2e8f0",
            }}
          >
            <th className="border px-1.5 py-1 text-left">
              Subject
            </th>

            {columns.includes(
              "max_marks"
            ) && (
              <th className="border px-1.5 py-1">
                Max
              </th>
            )}

            {columns.includes(
              "pass_marks"
            ) && (
              <th className="border px-1.5 py-1">
                Pass
              </th>
            )}

            {columns.includes(
              "obtained"
            ) && (
              <th className="border px-1.5 py-1">
                Obt.
              </th>
            )}

            {columns.includes(
              "grade"
            ) && (
              <th className="border px-1.5 py-1">
                Grade
              </th>
            )}

            {columns.includes(
              "remark"
            ) && (
              <th className="border px-1.5 py-1 text-left">
                Remark
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              <td className="border px-1.5 py-1 font-semibold">
                {row[0]}
              </td>

              {columns.includes(
                "max_marks"
              ) && (
                <td className="border px-1.5 py-1 text-center">
                  {row[1]}
                </td>
              )}

              {columns.includes(
                "pass_marks"
              ) && (
                <td className="border px-1.5 py-1 text-center">
                  {row[2]}
                </td>
              )}

              {columns.includes(
                "obtained"
              ) && (
                <td className="border px-1.5 py-1 text-center font-bold">
                  {row[3]}
                </td>
              )}

              {columns.includes(
                "grade"
              ) && (
                <td className="border px-1.5 py-1 text-center font-bold">
                  {row[4]}
                </td>
              )}

              {columns.includes(
                "remark"
              ) && (
                <td className="border px-1.5 py-1">
                  {row[5]}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoScholasticPreview({
  settings,
  theme,
}: {
  settings?: BuilderSettings;
  theme: Theme;
}) {
  const section =
    settings?.co_scholastic || {};

  if (section.enabled === false) {
    return null;
  }

  const rows = [
    ["Art Education", "A", "Excellent"],
    ["Physical & Health Education", "A+", "Outstanding"],
    ["General Knowledge", "A", "Very Good"],
    ["Social Service", "A", "Excellent"],
  ];

  return (
    <div className="h-full w-full overflow-hidden">
      <div
        className="border-b px-2 py-1.5 text-[10px] font-bold"
        style={{
          background:
            theme.headerBg ||
            "#f8fafc",
          borderColor:
            theme.border ||
            "#cbd5e1",
        }}
      >
        {section.title ||
          "Co-Scholastic Activities"}
      </div>

      <table className="w-full border-collapse text-[8px]">
        <thead>
          <tr
            style={{
              background:
                theme.tableHeader ||
                "#e2e8f0",
            }}
          >
            <th className="border px-1.5 py-1 text-left">
              Activity
            </th>

            {section.showGrade !== false && (
              <th className="border px-1.5 py-1">
                Grade
              </th>
            )}

            {section.showRemark !== false && (
              <th className="border px-1.5 py-1 text-left">
                Remark
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              <td className="border px-1.5 py-1 font-semibold">
                {row[0]}
              </td>

              {section.showGrade !== false && (
                <td className="border px-1.5 py-1 text-center font-bold">
                  {row[1]}
                </td>
              )}

              {section.showRemark !== false && (
                <td className="border px-1.5 py-1">
                  {row[2]}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultSummaryPreview({
  settings,
  theme,
}: {
  settings?: BuilderSettings;
  theme: Theme;
}) {
  const result =
    settings?.result || {};

  if (result.enabled === false) {
    return null;
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <div
        className="border-b px-2 py-1.5 text-[10px] font-bold"
        style={{
          background:
            theme.headerBg ||
            "#f8fafc",
          borderColor:
            theme.border ||
            "#cbd5e1",
        }}
      >
        {result.title ||
          "Result Summary"}
      </div>

      <div className="grid grid-cols-3 gap-0">
        {result.showTotal !== false && (
          <SummaryBox
            label="Total"
            value="426 / 500"
            theme={theme}
          />
        )}

        {result.showPercentage !== false && (
          <SummaryBox
            label="Percentage"
            value="85.20%"
            theme={theme}
          />
        )}

        {result.showGrade !== false && (
          <SummaryBox
            label="Grade"
            value="A"
            theme={theme}
          />
        )}

        {result.showDivision !== false && (
          <SummaryBox
            label="Division"
            value="I"
            theme={theme}
          />
        )}

        {result.showResult !== false && (
          <SummaryBox
            label="Result"
            value="PASS"
            theme={theme}
          />
        )}

        {result.showRank !== false && (
          <SummaryBox
            label="Rank"
            value="03"
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: Theme;
}) {
  return (
    <div
      className="border px-2 py-2"
      style={{
        borderColor:
          theme.border ||
          "#cbd5e1",
      }}
    >
      <div
        className="text-[7px] font-semibold uppercase"
        style={{
          color:
            theme.muted ||
            "#64748b",
        }}
      >
        {label}
      </div>

      <div
        className="mt-0.5 text-[10px] font-bold"
        style={{
          color:
            theme.text ||
            "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AttendancePreview({
  settings,
  theme,
}: {
  settings?: BuilderSettings;
  theme: Theme;
}) {
  const attendance =
    settings?.attendance || {};

  if (attendance.enabled === false) {
    return null;
  }

  return (
    <div
      className="grid h-full w-full grid-cols-3 overflow-hidden"
      style={{
        borderColor:
          theme.border ||
          "#cbd5e1",
      }}
    >
      {attendance.showWorkingDays !==
        false && (
        <SummaryBox
          label="Working Days"
          value="220"
          theme={theme}
        />
      )}

      {attendance.showPresentDays !==
        false && (
        <SummaryBox
          label="Present Days"
          value="204"
          theme={theme}
        />
      )}

      {attendance.showPercentage !==
        false && (
        <SummaryBox
          label="Attendance"
          value="92.73%"
          theme={theme}
        />
      )}
    </div>
  );
}

function RemarksPreview({
  settings,
  theme,
}: {
  settings?: BuilderSettings;
  theme: Theme;
}) {
  const remarks =
    settings?.remarks || {};

  if (remarks.enabled === false) {
    return null;
  }

  return (
    <div className="h-full w-full">
      <div
        className="mb-1 text-[9px] font-bold"
        style={{
          color:
            theme.text ||
            "#0f172a",
        }}
      >
        Remarks
      </div>

      <div className="grid grid-cols-2 gap-2 text-[8px]">
        {remarks.classTeacher !== false && (
          <div
            className="rounded border p-2"
            style={{
              borderColor:
                theme.border ||
                "#cbd5e1",
            }}
          >
            <div
              className="font-bold"
              style={{
                color:
                  theme.secondary ||
                  "#334155",
              }}
            >
              Class Teacher
            </div>

            <div className="mt-1 text-slate-600">
              Very good performance. Keep improving.
            </div>
          </div>
        )}

        {remarks.principal !== false && (
          <div
            className="rounded border p-2"
            style={{
              borderColor:
                theme.border ||
                "#cbd5e1",
            }}
          >
            <div
              className="font-bold"
              style={{
                color:
                  theme.secondary ||
                  "#334155",
              }}
            >
              Principal
            </div>

            <div className="mt-1 text-slate-600">
              Promoted to next class.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SignaturesPreview({
  settings,
  theme,
}: {
  settings?: BuilderSettings;
  theme: Theme;
}) {
  const signatures =
    settings?.signatures || {};

  if (signatures.enabled === false) {
    return null;
  }

  const items: string[] = [];

  if (signatures.classTeacher !== false) {
    items.push("Class Teacher");
  }

  if (signatures.principal !== false) {
    items.push("Principal");
  }

  if (signatures.parent !== false) {
    items.push("Parent / Guardian");
  }

  return (
    <div
      className="flex h-full w-full items-end justify-between gap-3"
      style={{
        color:
          theme.text ||
          "#0f172a",
      }}
    >
      {items.map((item) => (
        <div
          key={item}
          className="min-w-0 flex-1 text-center"
        >
          <div className="mb-2 h-5 border-b border-slate-400" />
          <div className="text-[8px] font-bold">
            {item}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({
  title,
}: {
  title: string;
}) {
  return (
    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {title}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-xs hover:bg-slate-50">
      <span className="font-medium text-slate-700">
        {label}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() =>
          onChange(!checked)
        }
        className={`relative h-5 w-9 rounded-full transition ${
          checked
            ? "bg-blue-600"
            : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked
              ? "left-[18px]"
              : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}


export default function ReportCardTemplateBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 p-6">
          <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-4 w-80 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      }
    >
      <ReportCardTemplateBuilderPageContent />
    </Suspense>
  );
}
