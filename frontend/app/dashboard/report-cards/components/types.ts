export type TextAlign = "left" | "center" | "right";

export type ReportCardElementType =
  | "school_header"
  | "report_title"
  | "result_header"
  | "result_date"
  | "student_info"
  | "student_details"
  | "academic_table"
  | "academic_subjects_table"
  | "co_scholastic"
  | "co_scholastic_table"
  | "summary"
  | "result_summary"
  | "attendance"
  | "remarks"
  | "signatures"
  | "image"
  | "logo"
  | "section_heading"
  | "custom_text"
  | "divider";

export type ReportCardElement = {
  id: string;
  type: ReportCardElementType | string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  text?: string;
  props: Record<string, unknown>;
  style: Record<string, unknown>;
};

export type ReportCardTemplate = {
  id?: number;
  name: string;
  description?: string | null;
  page_size: string;
  orientation: "portrait" | "landscape";
  settings: Record<string, unknown>;
  elements: ReportCardElement[];
};

type LegacyElement = Record<string, unknown>;
type LegacyTemplate = Record<string, unknown>;

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const number = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const textAlign = (value: unknown): TextAlign =>
  value === "center" || value === "right" ? value : "left";

export function normalizeReportCardElement(
  input: unknown,
  index: number,
): ReportCardElement {
  const legacy = record(input) as LegacyElement;
  const legacyStyle = record(legacy.style);
  const legacyProps = record(legacy.props);
  const style: Record<string, unknown> = {
    ...legacyStyle,
    fontSize: legacyStyle.fontSize ?? legacy.fontSize ?? legacy.font_size ?? 12,
    fontWeight:
      legacyStyle.fontWeight ?? legacy.fontWeight ?? legacy.font_weight ?? "normal",
    textAlign: textAlign(
      legacyStyle.textAlign ?? legacy.align ?? legacy.alignment,
    ),
    color: legacyStyle.color ?? legacy.color ?? "#0f172a",
    backgroundColor:
      legacyStyle.backgroundColor ?? legacyStyle.background ?? legacy.background_color ?? "transparent",
    borderColor: legacyStyle.borderColor ?? legacy.border_color ?? "#cbd5e1",
    borderWidth: legacyStyle.borderWidth ?? legacy.border_width ?? 0,
    borderRadius: legacyStyle.borderRadius ?? 0,
    padding: legacyStyle.padding ?? legacy.padding ?? 0,
  };

  return {
    id: typeof legacy.id === "string" ? legacy.id : `element-${index}`,
    type: typeof legacy.type === "string" ? legacy.type : "custom_text",
    x: number(legacy.x, 24),
    y: number(legacy.y, 24),
    width: number(legacy.width, 200),
    height: number(legacy.height, 50),
    zIndex: number(legacy.zIndex, index + 1),
    visible: legacy.visible !== false,
    locked: legacy.locked === true,
    text: typeof legacy.text === "string" ? legacy.text : undefined,
    props: {
      ...legacyProps,
      text:
        legacyProps.text ??
        (typeof legacy.text === "string" ? legacy.text : undefined),
      src: legacyProps.src ?? legacy.src ?? legacy.imageUrl,
    },
    style,
  };
}

export function normalizeReportCardTemplate(input: unknown): ReportCardTemplate {
  const legacy = record(input) as LegacyTemplate;
  const settings = record(legacy.settings);
  const page = record(settings.page);
  const rawElements = Array.isArray(legacy.elements) ? legacy.elements : [];

  return {
    id: typeof legacy.id === "number" ? legacy.id : undefined,
    name: typeof legacy.name === "string" ? legacy.name : "Report Card Template",
    description:
      typeof legacy.description === "string" ? legacy.description : null,
    page_size:
      typeof legacy.page_size === "string"
        ? legacy.page_size
        : typeof page.size === "string"
          ? page.size
          : "A4",
    orientation:
      legacy.orientation === "landscape" || page.orientation === "landscape"
        ? "landscape"
        : "portrait",
    settings,
    elements: rawElements.map(normalizeReportCardElement),
  };
}

export function templatePageDimensions(template: ReportCardTemplate) {
  const landscape = template.orientation === "landscape";
  const base = template.page_size.toUpperCase();
  const size =
    base === "A5" ? { width: 559, height: 794 } :
    base === "LETTER" ? { width: 816, height: 1056 } :
    { width: 794, height: 1123 };

  return landscape
    ? { width: size.height, height: size.width }
    : size;
}
