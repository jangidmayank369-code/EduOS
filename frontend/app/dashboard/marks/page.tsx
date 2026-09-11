"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type Exam = {
  id: number;
  name: string;
  exam_type?: string;
  academic_year?: string | null;
  term?: string | null;
  status: string;
  include_in_result?: boolean;
  weightage?: number;
};

type AssessmentComponent = "WRITTEN" | "ORAL" | "OTHER";

const getAssessmentComponent = (exam: Exam): AssessmentComponent => {
  const text = `${exam.name} ${exam.exam_type || ""}`.toLowerCase();

  if (/\boral\b|\bviva\b|\bconversation\b|\bspoken\b/.test(text)) {
    return "ORAL";
  }

  if (/\bwritten\b|\btheory\b|\bpaper\b/.test(text)) {
    return "WRITTEN";
  }

  return "OTHER";
};

const normalizeComponentType = (value?: string): AssessmentComponent => {
  const text = (value || "").trim().toLowerCase();
  if (/oral|viva|conversation|spoken/.test(text)) return "ORAL";
  if (/written|theory|paper|exam/.test(text)) return "WRITTEN";
  return "OTHER";
};

const getAssessmentLabel = (exam: Exam): string => {
  const text = exam.name.trim();
  const component = getAssessmentComponent(exam);

  if (component === "ORAL" && !/\boral\b/i.test(text)) {
    return `${text} • Oral`;
  }

  if (component === "WRITTEN" && !/\bwritten\b/i.test(text)) {
    return `${text} • Written`;
  }

  return text;
};

type SchoolClass = {
  id: number;
  name: string;
  section?: string | null;
};

type Subject = {
  id: number;
  name: string;
  code?: string | null;
};

type ExamSubject = {
  exam_id: number;
  class_id: number;
  subject_id: number;
  max_marks: number;
  pass_marks: number;
  is_optional: boolean;
  include_in_result: boolean;
  components?: ExamSubjectComponent[];
};

type ExamSubjectComponent = {
  key: string;
  name: string;
  type?: string;
  max_marks: number;
  pass_marks?: number;
  include_in_result?: boolean;
  is_optional?: boolean;
  display_order?: number;
};

type Student = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  admission_number?: string | null;
  roll_number?: string | number | null;
  class_id?: number | null;
  status?: string | null;
};

type Mark = {
  id: number;
  student_id: number;
  exam_id: number;
  subject_id: number;
  marks_obtained: number;
  max_marks: number;
  entered_by: number;
  created_at: string;
  updated_at: string;
  percentage: number;
  grade: string;
};

type MarkRow = {
  student: Student;
  markId: number | null;
  value: string;
};

const getToken = () => localStorage.getItem("access_token");

const getStudentName = (student: Student) => {
  if (student.name) return student.name;

  return [student.first_name, student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || `Student #${student.id}`;
};

const getClassName = (schoolClass: SchoolClass) => {
  if (schoolClass.section) {
    return `${schoolClass.name} - ${schoolClass.section}`;
  }

  return schoolClass.name;
};

const calculatePercentage = (
  value: number,
  maxMarks: number,
): number => {
  if (!maxMarks || maxMarks <= 0) return 0;

  return Math.round((value / maxMarks) * 10000) / 100;
};

const calculateGrade = (percentage: number): string => {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
};

const isValidNumericMark = (
  value: string,
  maxMarks: number,
): boolean => {
  if (value.trim() === "") return true;

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return false;
  if (numeric < 0) return false;
  if (numeric > maxMarks) return false;

  return true;
};

const apiFetch = async (
  path: string,
  options: RequestInit = {},
): Promise<Response> => {
  const token = getToken();

  if (!token) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
};

export default function MarksEntryPage() {
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [assessmentComponent, setAssessmentComponent] =
    useState<"ALL" | AssessmentComponent>("ALL");
  const [selectedComponentKey, setSelectedComponentKey] = useState("");
  const [savedComponentValues, setSavedComponentValues] = useState<Record<number, string>>({});

  const [rows, setRows] = useState<MarkRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [pasteMode, setPasteMode] = useState(false);

  const inputRefs = useRef<
    Record<string, HTMLInputElement | null>
  >({});

  const assessmentExams = useMemo(() => {
    if (assessmentComponent === "ALL") return exams;

    return exams.filter(
      (exam) =>
        getAssessmentComponent(exam) === assessmentComponent,
    );
  }, [exams, assessmentComponent]);

  const selectedExam = useMemo(
    () =>
      exams.find(
        (exam) => String(exam.id) === selectedExamId,
      ) || null,
    [exams, selectedExamId],
  );

  const selectedAssessmentComponent = selectedExam
    ? getAssessmentComponent(selectedExam)
    : null;

  const selectedAssessmentLabel = selectedExam
    ? getAssessmentLabel(selectedExam)
    : "";

  const selectedClass = useMemo(
    () =>
      classes.find(
        (schoolClass) =>
          String(schoolClass.id) === selectedClassId,
      ) || null,
    [classes, selectedClassId],
  );

  const selectedSubject = useMemo(
    () =>
      subjects.find(
        (subject) =>
          String(subject.id) === selectedSubjectId,
      ) || null,
    [subjects, selectedSubjectId],
  );

  const selectedExamSubject = useMemo(() => {
    if (!selectedExamId || !selectedClassId || !selectedSubjectId) {
      return null;
    }

    return (
      examSubjects.find(
        (item) =>
          item.exam_id === Number(selectedExamId) &&
          item.class_id === Number(selectedClassId) &&
          item.subject_id === Number(selectedSubjectId),
      ) || null
    );
  }, [
    examSubjects,
    selectedExamId,
    selectedClassId,
    selectedSubjectId,
  ]);

  const configuredComponents = useMemo(() => {
    const list = selectedExamSubject?.components || [];
    return [...list].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }, [selectedExamSubject]);

  const selectedComponent = useMemo(() => {
    if (!configuredComponents.length) return null;
    return configuredComponents.find((item) => item.key === selectedComponentKey) || configuredComponents[0];
  }, [configuredComponents, selectedComponentKey]);

  const maxMarks = selectedComponent?.max_marks ?? selectedExamSubject?.max_marks ?? 100;
  const passMarks = selectedComponent?.pass_marks ?? selectedExamSubject?.pass_marks ?? 40;

  const examLocked =
    selectedExam?.status === "LOCKED" ||
    selectedExam?.status === "PUBLISHED";

  const hasSelection =
    Boolean(selectedExamId) &&
    Boolean(selectedClassId) &&
    Boolean(selectedSubjectId);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((row) => {
      const name = getStudentName(row.student).toLowerCase();

      const admission =
        row.student.admission_number
          ?.toString()
          .toLowerCase() || "";

      const roll =
        row.student.roll_number
          ?.toString()
          .toLowerCase() || "";

      return (
        name.includes(query) ||
        admission.includes(query) ||
        roll.includes(query)
      );
    });
  }, [rows, search]);

  const enteredCount = useMemo(
    () =>
      rows.filter(
        (row) => row.value.trim() !== "",
      ).length,
    [rows],
  );

  const numericRows = useMemo(
    () =>
      rows
        .map((row) => ({
          ...row,
          numericValue:
            row.value.trim() === ""
              ? null
              : Number(row.value),
        }))
        .filter(
          (row) =>
            row.numericValue !== null &&
            Number.isFinite(row.numericValue),
        ),
    [rows],
  );

  const passCount = useMemo(
    () =>
      numericRows.filter(
        (row) =>
          Number(row.numericValue) >= passMarks,
      ).length,
    [numericRows, passMarks],
  );

  const failCount = useMemo(
    () =>
      numericRows.filter(
        (row) =>
          Number(row.numericValue) < passMarks,
      ).length,
    [numericRows, passMarks],
  );

  const average = useMemo(() => {
    if (!numericRows.length) return 0;

    const total = numericRows.reduce(
      (sum, row) =>
        sum + Number(row.numericValue || 0),
      0,
    );

    return Math.round(
      (total / numericRows.length) * 100,
    ) / 100;
  }, [numericRows]);

  const hasChanges = useMemo(() => {
    return rows.some((row) => row.value.trim() !== (savedComponentValues[row.student.id] || ""));
  }, [rows, savedComponentValues]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      const [examsResponse, classesResponse, subjectsResponse] =
        await Promise.all([
          apiFetch("/exams/"),
          apiFetch("/classes"),
          apiFetch("/subjects"),
        ]);

      if (!examsResponse.ok) {
        throw new Error("Failed to load exams");
      }

      if (!classesResponse.ok) {
        throw new Error("Failed to load classes");
      }

      if (!subjectsResponse.ok) {
        throw new Error("Failed to load subjects");
      }

      const examsData = await examsResponse.json();
      const classesData = await classesResponse.json();
      const subjectsData = await subjectsResponse.json();

      setExams(
        Array.isArray(examsData)
          ? examsData
          : examsData.items || [],
      );

      setClasses(
        Array.isArray(classesData)
          ? classesData
          : classesData.items || [],
      );

      setSubjects(
        Array.isArray(subjectsData)
          ? subjectsData
          : subjectsData.items || [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load marks entry data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Component filter is only a discovery/filter control. It must not
  // invalidate the currently selected exam when the user changes the filter.
  // The selected exam remains the source of truth for mark storage because
  // the backend mark key is student + exam + subject.

  const loadExamSubjects = async (examId: string) => {
    if (!examId) {
      setExamSubjects([]);
      return;
    }

    try {
      const response = await apiFetch(
        `/exam-subjects/exam/${examId}`,
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load exam subject configuration",
        );
      }

      const data = await response.json();

      setExamSubjects(
        Array.isArray(data)
          ? data
          : data.items || [],
      );
    } catch (err) {
      setExamSubjects([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load exam subjects",
      );
    }
  };

  useEffect(() => {
    if (!selectedExamId) {
      setExamSubjects([]);
      return;
    }

    loadExamSubjects(selectedExamId);
  }, [selectedExamId]);

  const loadGrid = async () => {
    if (!hasSelection) {
      setRows([]);
      setMarks([]);
      return;
    }

    try {
      setLoadingGrid(true);
      setError("");
      setSuccess("");

      const studentsResponse = await apiFetch(
        `/students/`,
      );

      if (!studentsResponse.ok) {
        throw new Error("Failed to load students");
      }

      const studentsData = await studentsResponse.json();

      const allStudents: Student[] = Array.isArray(
        studentsData,
      )
        ? studentsData
        : studentsData.items || [];

      const classStudents = allStudents.filter(
        (student) =>
          Number(student.class_id) ===
            Number(selectedClassId) &&
          (!student.status ||
            student.status === "ACTIVE"),
      );

      setStudents(classStudents);

      const markResponses = await Promise.all(
        classStudents.map(async (student) => {
          const response = await apiFetch(
            `/marks/student/${student.id}`,
          );

          if (!response.ok) {
            return [] as Mark[];
          }

          const data = await response.json();

          return Array.isArray(data)
            ? data
            : [];
        }),
      );

      const relevantMarks = markResponses
        .flat()
        .filter(
          (mark) =>
            mark.exam_id === Number(selectedExamId) &&
            mark.subject_id === Number(selectedSubjectId),
        );

      setMarks(relevantMarks);

      if (selectedComponent) {
        const componentResponses = await Promise.all(
          classStudents.map(async (student) => {
            const response = await apiFetch(
              `/marks/components/student/${student.id}?exam_id=${Number(selectedExamId)}&subject_id=${Number(selectedSubjectId)}`,
            );
            if (!response.ok) return { studentId: student.id, components: [] as any[] };
            const data = await response.json();
            return { studentId: student.id, components: Array.isArray(data?.components) ? data.components : [] };
          }),
        );

        const values: Record<number, string> = {};
        const rowsNext = classStudents.map((student) => {
          const legacy = relevantMarks.find((mark) => mark.student_id === student.id);
          const response = componentResponses.find((item) => item.studentId === student.id);
          const component = response?.components?.find((item: any) => item.component_key === selectedComponent.key);
          const value = component?.marks_obtained != null
            ? String(component.marks_obtained)
            : "";
          values[student.id] = value;
          return {
            student,
            markId: component?.mark_id || legacy?.id || null,
            value,
          };
        });

        setSavedComponentValues(values);
        setRows(rowsNext);
      } else {
        const marksByStudent = new Map(relevantMarks.map((mark) => [mark.student_id, mark]));
        const values: Record<number, string> = {};
        const rowsNext = classStudents.map((student) => {
          const existing = marksByStudent.get(student.id);
          const value = existing?.marks_obtained !== undefined ? String(existing.marks_obtained) : "";
          values[student.id] = value;
          return { student, markId: existing?.id || null, value };
        });
        setSavedComponentValues(values);
        setRows(rowsNext);
      }
    } catch (err) {
      setRows([]);
      setMarks([]);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load marks",
      );
    } finally {
      setLoadingGrid(false);
    }
  };

  useEffect(() => {
    if (
      selectedExamId &&
      selectedClassId &&
      selectedSubjectId
    ) {
      loadGrid();
    } else {
      setRows([]);
      setMarks([]);
    }
  }, [
    selectedExamId,
    selectedClassId,
    selectedSubjectId,
    selectedComponentKey,
  ]);

  const handleExamChange = (
    value: string,
  ) => {
    if (hasChanges) {
      const confirmed = window.confirm(
        "Unsaved marks hain. Exam change karna hai?",
      );

      if (!confirmed) return;
    }

    const nextExam = exams.find(
      (exam) => String(exam.id) === value,
    );

    setSelectedExamId(value);
    setSelectedClassId("");
    setSelectedSubjectId("");
    setSelectedComponentKey("");
    setRows([]);
    setMarks([]);
    setSavedComponentValues({});

    if (nextExam) {
      setAssessmentComponent(getAssessmentComponent(nextExam));
    }
  };

  const handleClassChange = (
    value: string,
  ) => {
    if (hasChanges) {
      const confirmed = window.confirm(
        "Unsaved marks hain. Class change karna hai?",
      );

      if (!confirmed) return;
    }

    setSelectedClassId(value);
    setSelectedComponentKey("");
    setRows([]);
    setMarks([]);
    setSavedComponentValues({});
  };

  const handleSubjectChange = (
    value: string,
  ) => {
    if (hasChanges) {
      const confirmed = window.confirm(
        "Unsaved marks hain. Subject change karna hai?",
      );

      if (!confirmed) return;
    }

    setSelectedSubjectId(value);
    setSelectedComponentKey("");
    setRows([]);
    setMarks([]);
    setSavedComponentValues({});
  };

  const updateRowValue = (
    studentId: number,
    value: string,
  ) => {
    if (examLocked) return;

    if (
      value !== "" &&
      !/^\d*\.?\d*$/.test(value)
    ) {
      return;
    }

    if (!isValidNumericMark(value, maxMarks)) {
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.student.id === studentId
          ? {
              ...row,
              value,
            }
          : row,
      ),
    );
  };

  const focusCell = (
    index: number,
  ) => {
    const row = filteredRows[index];

    if (!row) return;

    const input =
      inputRefs.current[
        String(row.student.id)
      ];

    if (input) {
      input.focus();
      input.select();
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (
      event.key !== "Enter" &&
      event.key !== "Tab" &&
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp"
    ) {
      return;
    }

    event.preventDefault();

    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === "Tab"
    ) {
      focusCell(
        Math.min(
          index + 1,
          filteredRows.length - 1,
        ),
      );

      return;
    }

    if (event.key === "ArrowUp") {
      focusCell(
        Math.max(index - 1, 0),
      );
    }
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    startIndex: number,
  ) => {
    if (examLocked) return;

    const text =
      event.clipboardData.getData("text");

    if (!text) return;

    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    if (lines.length <= 1) {
      return;
    }

    event.preventDefault();

    const values: string[] = [];

    lines.forEach((line) => {
      const columns = line.split("\t");

      columns.forEach((column) => {
        values.push(column.trim());
      });
    });

    setRows((current) => {
      const next = [...current];

      values.forEach((value, offset) => {
        const targetRow =
          filteredRows[startIndex + offset];

        if (!targetRow) return;

        const targetIndex =
          next.findIndex(
            (row) =>
              row.student.id ===
              targetRow.student.id,
          );

        if (targetIndex === -1) return;

        if (
          value === "" ||
          isValidNumericMark(
            value,
            maxMarks,
          )
        ) {
          next[targetIndex] = {
            ...next[targetIndex],
            value,
          };
        }
      });

      return next;
    });

    setPasteMode(true);

    window.setTimeout(() => {
      setPasteMode(false);
    }, 1500);
  };

  const saveAllMarks = async () => {
    if (examLocked) {
      setError(
        "Locked ya Published exam mein marks edit nahi kar sakte.",
      );
      return;
    }

    if (
      !selectedExamId ||
      !selectedSubjectId
    ) {
      setError(
        "Exam aur subject select karein.",
      );
      return;
    }

    if (!rows.length) {
      setError(
        "Save karne ke liye students nahi hain.",
      );
      return;
    }

    const invalidRows = rows.filter(
      (row) =>
        row.value.trim() !== "" &&
        !isValidNumericMark(
          row.value,
          maxMarks,
        ),
    );

    if (invalidRows.length) {
      setError(
        `${invalidRows.length} student ke marks invalid hain.`,
      );
      return;
    }

    const items = rows.map((row) => ({
      student_id: row.student.id,
      marks_obtained: row.value.trim() === "" ? null : Number(row.value),
    }));

    if (!items.some((item) => item.marks_obtained !== null)) {
      setError(
        "Kam se kam ek mark enter karein.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await apiFetch(
        selectedComponent ? "/marks/components/bulk" : "/marks/bulk",
        {
          method: "POST",
          body: JSON.stringify(
            selectedComponent
              ? {
                  exam_id: Number(selectedExamId),
                  subject_id: Number(selectedSubjectId),
                  component_key: selectedComponent.key,
                  component_name: selectedComponent.name,
                  component_type: normalizeComponentType(selectedComponent.type),
                  max_marks: selectedComponent.max_marks,
                  pass_marks: selectedComponent.pass_marks ?? 0,
                  items,
                }
              : {
                  exam_id: Number(selectedExamId),
                  subject_id: Number(selectedSubjectId),
                  items: items.filter((item) => item.marks_obtained !== null).map((item) => ({
                    ...item,
                    marks_obtained: item.marks_obtained as number,
                    max_marks: maxMarks,
                  })),
                },
          ),
        },
      );

      if (response.status === 401) {
        localStorage.removeItem(
          "access_token",
        );
        localStorage.removeItem(
          "user_role",
        );
        router.push("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Failed to save marks",
        );
      }

      setSuccess(
        `${data.saved_count ?? items.length} students ke marks save ho gaye.`,
      );

      await loadGrid();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save marks",
      );
    } finally {
      setSaving(false);
    }
  };

  const clearUnsavedMarks = () => {
    const confirmed = window.confirm(
      "Unsaved changes clear karni hain?",
    );

    if (!confirmed) return;

    setRows((current) =>
      current.map((row) => ({
        ...row,
        value: savedComponentValues[row.student.id] || "",
      })),
    );

    setError("");
    setSuccess("");
  };

  const subjectsForSelectedExam = useMemo(() => {
    if (!selectedExamId) {
      return [];
    }

    const subjectIds = new Set(
      examSubjects
        .filter(
          (item) =>
            item.exam_id ===
            Number(selectedExamId),
        )
        .map((item) => item.subject_id),
    );

    return subjects.filter((subject) =>
      subjectIds.has(subject.id),
    );
  }, [
    examSubjects,
    selectedExamId,
    subjects,
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-64 rounded bg-slate-200" />
              <div className="h-12 w-full rounded bg-slate-200" />
              <div className="h-64 w-full rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium text-indigo-600">
                Academic Management
              </div>

              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Marks Entry
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Enter Written / Oral assessment marks first. Final totals and report cards are calculated later.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedExam && (
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {selectedExam.status}
                </span>
              )}

              {hasChanges && !examLocked && (
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Assessment Component
              </label>

              <select
                value={assessmentComponent}
                onChange={(event) => {
                  if (hasChanges) {
                    const confirmed = window.confirm(
                      "Unsaved marks hain. Assessment component change karna hai?",
                    );
                    if (!confirmed) return;
                  }

                  setAssessmentComponent(
                    event.target.value as "ALL" | AssessmentComponent,
                  );
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">All Components</option>
                <option value="WRITTEN">Written</option>
                <option value="ORAL">Oral</option>
                <option value="OTHER">Other</option>
              </select>

              <p className="mt-1.5 text-xs text-slate-400">
                Class 6 onward can use both Written and Oral assessments.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Assessment / Exam
              </label>

              <select
                value={selectedExamId}
                onChange={(event) =>
                  handleExamChange(
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">
                  Select exam
                </option>

                {assessmentExams.map((exam) => (
                  <option
                    key={exam.id}
                    value={exam.id}
                  >
                    {getAssessmentLabel(exam)}
                    {exam.exam_type &&
                    !/written|oral|viva|theory|paper/i.test(exam.name)
                      ? ` • ${exam.exam_type}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Class
              </label>

              <select
                value={selectedClassId}
                onChange={(event) =>
                  handleClassChange(
                    event.target.value,
                  )
                }
                disabled={!selectedExamId}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition disabled:bg-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">
                  Select class
                </option>

                {classes.map((schoolClass) => (
                  <option
                    key={schoolClass.id}
                    value={schoolClass.id}
                  >
                    {getClassName(
                      schoolClass,
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Subject
              </label>

              <select
                value={selectedSubjectId}
                onChange={(event) =>
                  handleSubjectChange(
                    event.target.value,
                  )
                }
                disabled={
                  !selectedExamId ||
                  !selectedClassId
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition disabled:bg-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">
                  Select subject
                </option>

                {subjectsForSelectedExam.map(
                  (subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.name}
                      {subject.code
                        ? ` (${subject.code})`
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          {selectedExamSubject && configuredComponents.length > 0 && (
            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Assessment Component</label>
                  <select
                    value={selectedComponent?.key || ""}
                    onChange={(event) => {
                      if (hasChanges && !window.confirm("Unsaved marks hain. Assessment component change karna hai?")) return;
                      setSelectedComponentKey(event.target.value);
                    }}
                    className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    {configuredComponents.map((component) => (
                      <option key={component.key} value={component.key}>
                        {component.name} • {(component.type || "OTHER").toUpperCase()} • Max {component.max_marks}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-lg bg-white px-3 py-2 text-indigo-700">Max: {selectedComponent?.max_marks ?? "—"}</span>
                  <span className="rounded-lg bg-white px-3 py-2 text-emerald-700">Pass: {selectedComponent?.pass_marks ?? 0}</span>
                </div>
              </div>
            </div>
          )}

          {selectedExamSubject && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                Max Marks: {maxMarks}
              </span>

              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Pass Marks: {passMarks}
              </span>

              {selectedExamSubject.is_optional && (
                <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Optional Subject
                </span>
              )}

              {selectedExamSubject.include_in_result && (
                <span className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                  Included in Result
                </span>
              )}
            </div>
          )}

          {selectedExam && selectedAssessmentComponent && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  selectedAssessmentComponent === "ORAL"
                    ? "bg-violet-50 text-violet-700"
                    : selectedAssessmentComponent === "WRITTEN"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {selectedAssessmentComponent === "ORAL"
                  ? "ORAL ASSESSMENT"
                  : selectedAssessmentComponent === "WRITTEN"
                    ? "WRITTEN ASSESSMENT"
                    : "ASSESSMENT"}
              </span>

              <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                Mark entry only — final report calculation is separate
              </span>
            </div>
          )}

          {selectedExam &&
            (selectedExam.status ===
              "LOCKED" ||
              selectedExam.status ===
                "PUBLISHED") && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                This exam is {selectedExam.status.toLowerCase()}.
                Marks editing is disabled.
              </div>
            )}
        </section>

        {hasSelection && selectedAssessmentComponent && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
            <span className="font-semibold text-slate-800">
              {selectedAssessmentLabel || "Assessment"}:
            </span>{" "}
            Enter marks for every student. <span className="font-semibold">0</span> is a valid mark;
            leave the cell blank only when the mark has not been entered yet.
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="font-bold"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        {/* Summary */}
        {hasSelection && (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-slate-500">
                Students
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {rows.length}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-slate-500">
                Entered
              </div>
              <div className="mt-1 text-2xl font-bold text-indigo-600">
                {enteredCount}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-slate-500">
                Passed
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">
                {passCount}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium text-slate-500">
                Failed
              </div>
              <div className="mt-1 text-2xl font-bold text-red-600">
                {failCount}
              </div>
            </div>

            <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-1">
              <div className="text-xs font-medium text-slate-500">
                Average
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {average}
              </div>
            </div>
          </section>
        )}

        {/* Marks grid */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                {selectedSubject
                  ? selectedSubject.name
                  : "Marks Grid"}
              </h2>

              {selectedClass && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {getClassName(selectedClass)}
                  {selectedExam
                    ? ` • ${selectedExam.name}`
                    : ""}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search student..."
                disabled={!rows.length}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:w-56"
              />

              <button
                type="button"
                onClick={clearUnsavedMarks}
                disabled={
                  !hasChanges ||
                  saving ||
                  examLocked
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={saveAllMarks}
                disabled={
                  saving ||
                  !hasSelection ||
                  !rows.length ||
                  examLocked
                }
                className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save All Marks"}
              </button>
            </div>
          </div>

          {!hasSelection ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                📝
              </div>

              <h3 className="mt-4 font-bold text-slate-900">
                Select Exam, Class & Subject
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Marks grid load karne ke liye upar se
                exam, class aur subject select karein.
              </p>
            </div>
          ) : loadingGrid ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />

              <p className="mt-4 text-sm text-slate-500">
                Students aur marks load ho rahe hain...
              </p>
            </div>
          ) : !rows.length ? (
            <div className="p-12 text-center">
              <div className="text-4xl">👨‍🎓</div>

              <h3 className="mt-3 font-bold text-slate-900">
                No students found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Selected class mein active students available nahi hain.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <span className="font-semibold">
                  Quick entry:
                </span>{" "}
                Excel se marks copy karke first marks cell par
                <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono shadow-sm">
                  Ctrl + V
                </span>
                karein.{" "}
                <span className="font-semibold">
                  Enter / Tab
                </span>{" "}
                next student par jayega.
              </div>

              {pasteMode && (
                <div className="border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700">
                  Paste detected — values grid mein fill ho gaye.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-[850px] w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="w-16 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        #
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Student
                      </th>

                      <th className="w-32 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Roll / Adm.
                      </th>

                      <th className="w-48 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Marks
                      </th>

                      <th className="w-28 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                        %
                      </th>

                      <th className="w-28 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                        Grade
                      </th>

                      <th className="w-28 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                        Result
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map(
                      (row, index) => {
                        const numeric =
                          row.value.trim() === ""
                            ? null
                            : Number(row.value);

                        const percentage =
                          numeric === null
                            ? 0
                            : calculatePercentage(
                                numeric,
                                maxMarks,
                              );

                        const grade =
                          numeric === null
                            ? "-"
                            : calculateGrade(
                                percentage,
                              );

                        const passed =
                          numeric !== null &&
                          numeric >= passMarks;

                        const rowNumber =
                          rows.findIndex(
                            (item) =>
                              item.student.id ===
                              row.student.id,
                          ) + 1;

                        return (
                          <tr
                            key={row.student.id}
                            className="border-b border-slate-100 transition hover:bg-slate-50"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-slate-500">
                              {rowNumber}
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">
                                {getStudentName(
                                  row.student,
                                )}
                              </div>

                              {row.student.admission_number && (
                                <div className="mt-0.5 text-xs text-slate-400">
                                  {row.student.admission_number}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-600">
                              {row.student.roll_number ||
                                row.student.admission_number ||
                                "—"}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <input
                                  ref={(element) => {
                                    inputRefs.current[
                                      String(
                                        row.student.id,
                                      )
                                    ] = element;
                                  }}
                                  type="text"
                                  inputMode="decimal"
                                  value={row.value}
                                  disabled={
                                    examLocked
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRowValue(
                                      row.student.id,
                                      event.target.value,
                                    )
                                  }
                                  onKeyDown={(
                                    event,
                                  ) =>
                                    handleKeyDown(
                                      event,
                                      index,
                                    )
                                  }
                                  onPaste={(
                                    event,
                                  ) =>
                                    handlePaste(
                                      event,
                                      index,
                                    )
                                  }
                                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-center font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                  placeholder="—"
                                />

                                <span className="text-xs text-slate-400">
                                  / {maxMarks}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-slate-700">
                                {numeric === null
                                  ? "—"
                                  : `${percentage}%`}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex min-w-10 justify-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                                  grade === "F"
                                    ? "bg-red-100 text-red-700"
                                    : grade === "-"
                                      ? "bg-slate-100 text-slate-500"
                                      : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {grade}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center">
                              {numeric ===
                              null ? (
                                <span className="text-xs font-medium text-slate-400">
                                  Pending
                                </span>
                              ) : (
                                <span
                                  className={`text-xs font-bold ${
                                    passed
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {passed
                                    ? "PASS"
                                    : "FAIL"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              {search &&
                filteredRows.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No student matches "{search}".
                  </div>
                )}
            </>
          )}
        </section>

        {/* Footer info */}
        {hasSelection && rows.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
              <div>
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {filteredRows.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {rows.length}
                </span>{" "}
                students
              </div>

              <div>
                Max:{" "}
                <span className="font-semibold text-slate-700">
                  {maxMarks}
                </span>
                {" • "}
                Pass:{" "}
                <span className="font-semibold text-slate-700">
                  {passMarks}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}