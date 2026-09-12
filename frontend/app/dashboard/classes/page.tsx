"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type SchoolClass = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Subject = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active?: boolean;
};

type Student = {
  id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_id?: number | null;
  section_id?: number | null;
  is_active: boolean;
  status?: string;
};

type Section = {
  id: number;
  class_id: number;
  name: string;
  class_teacher_id?: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Teacher = {
  id: number;
  employee_number?: string | null;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean;
};

type SectionSubjectTeacher = {
  id: number;
  section_id: number;
  subject_id: number;
  teacher_id: number;
  is_active: boolean;
};

type TimetablePeriod = {
  id: number;
  period_number: number;
  name: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  is_active: boolean;
};

type CoScholasticComponent = {
  id: number;
  class_id: number;
  name: string;
  component_type: "MARKS" | "GRADE" | "REMARK";
  max_marks: number | null;
  include_in_result: boolean;
  display_order: number;
  is_active: boolean;
};

type SectionTimetableRow = {
  id: number;
  section_id: number;
  period_id: number;
  day_of_week: number;
  subject_id: number | null;
  teacher_id: number | null;
  room_number?: string | null;
  is_active: boolean;
};

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
  message?: string;
};

type ClassForm = {
  name: string;
  description: string;
};

type CoForm = {
  name: string;
  component_type: "MARKS" | "GRADE" | "REMARK";
  max_marks: string;
  include_in_result: boolean;
  display_order: string;
};

type SectionForm = {
  name: string;
  class_teacher_id: string;
};

type PeriodForm = {
  period_number: string;
  name: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
};

type TimetableForm = {
  period_id: string;
  day_of_week: string;
  subject_id: string;
  teacher_id: string;
  room_number: string;
};

type SetupTab =
  | "overview"
  | "sections"
  | "students"
  | "subjects"
  | "co-scholastic"
  | "teachers"
  | "timetable";

function getErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const data = body as ApiErrorBody;

  if (typeof data.detail === "string") return data.detail;

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => item?.msg || "Validation error")
      .join(", ");
  }

  if (typeof data.message === "string") return data.message;
  return fallback;
}

function fullName(person: { first_name: string; last_name: string }) {
  return `${person.first_name} ${person.last_name}`.trim();
}

function dayName(day: number) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return days[day - 1] || `Day ${day}`;
}

export default function ClassesPage() {
  const router = useRouter();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const [showClassForm, setShowClassForm] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [setupTab, setSetupTab] = useState<SetupTab>("overview");
  const [setupLoading, setSetupLoading] = useState(false);

  const [sections, setSections] = useState<Section[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);
  const [coComponents, setCoComponents] = useState<CoScholasticComponent[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [sectionAssignments, setSectionAssignments] = useState<SectionSubjectTeacher[]>([]);
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [sectionTimetable, setSectionTimetable] = useState<SectionTimetableRow[]>([]);

  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm>({
    name: "",
    class_teacher_id: "",
  });
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionSaving, setSectionSaving] = useState(false);

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<SectionSubjectTeacher | null>(null);

  const [coForm, setCoForm] = useState<CoForm>({
    name: "",
    component_type: "GRADE",
    max_marks: "",
    include_in_result: false,
    display_order: "0",
  });
  const [editingCo, setEditingCo] = useState<CoScholasticComponent | null>(
    null
  );
  const [coSaving, setCoSaving] = useState(false);

  const [periodForm, setPeriodForm] = useState<PeriodForm>({
    period_number: "",
    name: "",
    start_time: "",
    end_time: "",
    is_break: false,
  });
  const [editingPeriod, setEditingPeriod] = useState<TimetablePeriod | null>(null);
  const [periodSaving, setPeriodSaving] = useState(false);

  const [timetableForm, setTimetableForm] = useState<TimetableForm>({
    period_id: "",
    day_of_week: "1",
    subject_id: "",
    teacher_id: "",
    room_number: "",
  });
  const [timetableSaving, setTimetableSaving] = useState(false);
  const [editingTimetableEntry, setEditingTimetableEntry] = useState<SectionTimetableRow | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<ClassForm>({
    name: "",
    description: "",
  });

  const token = () =>
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    router.push("/login");
  }, [router]);

  const request = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const accessToken = token();

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...(options?.body ? { "Content-Type": "application/json" } : {}),
          Authorization: `Bearer ${accessToken ?? ""}`,
          ...(options?.headers ?? {}),
        },
      });

      if (response.status === 401) {
        logout();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const text = await response.text();
      let body: unknown = null;

      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = null;
        }
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            body,
            `Request failed with status ${response.status}`
          )
        );
      }

      return (body ?? {}) as T;
    },
    [logout]
  );

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [classData, subjectData, studentData, teacherData] =
        await Promise.all([
          request<SchoolClass[]>("/classes/"),
          request<Subject[]>("/subjects/"),
          request<Student[]>("/students/"),
          request<Teacher[]>("/teachers/"),
        ]);

      setClasses(Array.isArray(classData) ? classData : []);
      setSubjects(Array.isArray(subjectData) ? subjectData : []);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setTeachers(Array.isArray(teacherData) ? teacherData : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load class data.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const accessToken = token();

    if (!accessToken) {
      router.push("/login");
      return;
    }

    queueMicrotask(() => {
      void loadBaseData();
    });
  }, [loadBaseData, router]);

  const activeClasses = classes.filter((item) => item.is_active).length;
  const inactiveClasses = classes.filter((item) => !item.is_active).length;

  const filteredClasses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return classes.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "inactive" && !item.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [classes, search, statusFilter]);

  const availableSubjects = useMemo(() => {
    const assignedIds = new Set(assignedSubjects.map((subject) => subject.id));

    return subjects.filter(
      (subject) =>
        subject.is_active !== false && !assignedIds.has(subject.id)
    );
  }, [assignedSubjects, subjects]);

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  const teacherById = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers]
  );

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId]
  );

  const resetClassForm = () => {
    setForm({
      name: "",
      description: "",
    });
    setEditingClass(null);
  };

  const openCreateClass = () => {
    setError("");
    setSuccess("");
    resetClassForm();
    setShowClassForm(true);
  };

  const openEditClass = (schoolClass: SchoolClass) => {
    setError("");
    setSuccess("");
    setEditingClass(schoolClass);
    setForm({
      name: schoolClass.name,
      description: schoolClass.description ?? "",
    });
    setShowClassForm(true);
  };

  const handleClassSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setError("Class name is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editingClass) {
        await request<SchoolClass>(`/classes/${editingClass.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name,
            description: form.description.trim() || null,
          }),
        });
        setSuccess("Class updated successfully.");
      } else {
        await request<SchoolClass>("/classes/", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: form.description.trim() || null,
          }),
        });
        setSuccess("Class created successfully.");
      }

      setShowClassForm(false);
      resetClassForm();
      await loadBaseData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : editingClass
            ? "Failed to update class."
            : "Failed to create class."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deactivateClass = async (schoolClass: SchoolClass) => {
    if (
      !window.confirm(
        `Deactivate "${schoolClass.name}"? Existing students and academic records will not be deleted.`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await request<SchoolClass>(`/classes/${schoolClass.id}`, {
        method: "DELETE",
      });
      setSuccess(`"${schoolClass.name}" was deactivated.`);
      await loadBaseData();

      if (selectedClass?.id === schoolClass.id) {
        setSelectedClass(null);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to deactivate class."
      );
    }
  };

  const loadSectionAcademics = useCallback(
    async (sectionId: number) => {
      const [assignmentData, timetableData] = await Promise.all([
        request<SectionSubjectTeacher[]>(
          `/sections/${sectionId}/subject-teachers`
        ),
        request<SectionTimetableRow[]>(`/sections/${sectionId}/timetable`),
      ]);

      setSectionAssignments(
        Array.isArray(assignmentData) ? assignmentData : []
      );
      setSectionTimetable(
        Array.isArray(timetableData) ? timetableData : []
      );
    },
    [request]
  );

  const loadClassSetup = useCallback(
    async (schoolClass: SchoolClass) => {
      setSetupLoading(true);
      setError("");

      try {
        const [sectionData, subjectData, coData, periodData] =
          await Promise.all([
            request<Section[]>(`/classes/${schoolClass.id}/sections/`),
            request<Subject[]>(`/classes/${schoolClass.id}/subjects`),
            request<CoScholasticComponent[]>(
              `/co-scholastic/components?class_id=${schoolClass.id}`
            ),
            request<TimetablePeriod[]>(`/timetable/periods`),
          ]);

        const nextSections = Array.isArray(sectionData) ? sectionData : [];
        setSections(nextSections);
        setAssignedSubjects(Array.isArray(subjectData) ? subjectData : []);
        setCoComponents(Array.isArray(coData) ? coData : []);
        setPeriods(Array.isArray(periodData) ? periodData : []);
        setClassStudents(
          students.filter(
            (student) =>
              student.class_id === schoolClass.id && student.is_active
          )
        );

        const firstActiveSection =
          nextSections.find((section) => section.is_active) ?? null;

        if (firstActiveSection) {
          setSelectedSectionId(firstActiveSection.id);
          await loadSectionAcademics(firstActiveSection.id);
        } else {
          setSelectedSectionId(null);
          setSectionAssignments([]);
          setSectionTimetable([]);
        }
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load class configuration."
        );
      } finally {
        setSetupLoading(false);
      }
    },
    [loadSectionAcademics, request, students]
  );

  const openClassSetup = async (schoolClass: SchoolClass) => {
    setSelectedClass(schoolClass);
    setSetupTab("overview");
    setSelectedSectionId(null);
    setEditingSection(null);
    setSectionForm({ name: "", class_teacher_id: "" });
    setSelectedSubjectId("");
    setSelectedTeacherId("");
    setEditingAssignment(null);
    setEditingPeriod(null);
    setEditingTimetableEntry(null);
    setSuccess("");
    setError("");
    await loadClassSetup(schoolClass);
  };

  const handleSectionChange = useCallback(
    (sectionId: number | null) => {
      setSelectedSectionId(sectionId);

      if (!sectionId || !selectedClass) {
        setSectionAssignments([]);
        setSectionTimetable([]);
        return;
      }

      void loadSectionAcademics(sectionId).catch((err) => {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load section academic setup."
        );
      });
    },
    [loadSectionAcademics, selectedClass]
  );

  const assignSubject = async () => {
    if (!selectedClass || !selectedSubjectId) {
      setError("Select a subject first.");
      return;
    }

    setAssignmentSaving(true);
    setError("");
    setSuccess("");

    try {
      await request(`/classes/${selectedClass.id}/subjects/${selectedSubjectId}`, {
        method: "POST",
      });

      setSuccess("Main subject assigned to the class.");
      setSelectedSubjectId("");
      await loadClassSetup(selectedClass);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to assign subject.");
    } finally {
      setAssignmentSaving(false);
    }
  };

  const removeSubject = async (subject: Subject) => {
    if (!selectedClass) return;

    if (!window.confirm(`Remove "${subject.name}" from ${selectedClass.name}?`)) {
      return;
    }

    setAssignmentSaving(true);
    setError("");
    setSuccess("");

    try {
      await request(
        `/classes/${selectedClass.id}/subjects/${subject.id}`,
        { method: "DELETE" }
      );

      setSuccess(`"${subject.name}" removed from the class.`);
      await loadClassSetup(selectedClass);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to remove subject."
      );
    } finally {
      setAssignmentSaving(false);
    }
  };

  const resetSectionForm = () => {
    setEditingSection(null);
    setSectionForm({ name: "", class_teacher_id: "" });
  };

  const saveSection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedClass) return;

    const name = sectionForm.name.trim();
    if (!name) {
      setError("Section name is required.");
      return;
    }

    setSectionSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        name,
        class_teacher_id: sectionForm.class_teacher_id
          ? Number(sectionForm.class_teacher_id)
          : null,
      };

      if (editingSection) {
        await request<Section>(
          `/classes/${selectedClass.id}/sections/${editingSection.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
        setSuccess(`Section "${name}" updated successfully.`);
      } else {
        await request<Section>(`/classes/${selectedClass.id}/sections/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess(`Section "${name}" created successfully.`);
      }

      resetSectionForm();
      await loadClassSetup(selectedClass);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to save section."
      );
    } finally {
      setSectionSaving(false);
    }
  };

  const deactivateSection = async (section: Section) => {
    if (!selectedClass) return;

    if (
      !window.confirm(
        `Deactivate section "${section.name}"? Students and academic records will not be deleted.`
      )
    ) {
      return;
    }

    setSectionSaving(true);
    setError("");
    setSuccess("");

    try {
      await request<Section>(
        `/classes/${selectedClass.id}/sections/${section.id}`,
        { method: "DELETE" }
      );
      setSuccess(`Section "${section.name}" was deactivated.`);
      if (selectedSectionId === section.id) setSelectedSectionId(null);
      await loadClassSetup(selectedClass);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to deactivate section."
      );
    } finally {
      setSectionSaving(false);
    }
  };

  const editSection = (section: Section) => {
    setEditingSection(section);
    setSectionForm({
      name: section.name,
      class_teacher_id: section.class_teacher_id?.toString() ?? "",
    });
    setSetupTab("sections");
    setError("");
  };

  const resetCoForm = () => {
    setEditingCo(null);
    setCoForm({
      name: "",
      component_type: "GRADE",
      max_marks: "",
      include_in_result: false,
      display_order: String(coComponents.length),
    });
  };

  const editCoComponent = (component: CoScholasticComponent) => {
    setEditingCo(component);
    setCoForm({
      name: component.name,
      component_type: component.component_type,
      max_marks:
        component.max_marks === null ? "" : String(component.max_marks),
      include_in_result: component.include_in_result,
      display_order: String(component.display_order),
    });
  };

  const saveCoComponent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedClass) return;

    const name = coForm.name.trim();

    if (!name) {
      setError("Co-Scholastic component name is required.");
      return;
    }

    const maxMarks =
      coForm.component_type === "MARKS"
        ? Number(coForm.max_marks)
        : null;

    const displayOrder = Number(coForm.display_order);

    if (
      coForm.component_type === "MARKS" &&
      (!Number.isFinite(maxMarks) || maxMarks < 0)
    ) {
      setError("Maximum marks is required for MARKS type.");
      return;
    }

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      setError("Display order must be a non-negative whole number.");
      return;
    }

    setCoSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        name,
        component_type: coForm.component_type,
        max_marks: maxMarks,
        include_in_result: coForm.include_in_result,
        display_order: displayOrder,
        ...(editingCo ? {} : { class_id: selectedClass.id }),
      };

      if (editingCo) {
        await request<CoScholasticComponent>(
          `/co-scholastic/components/${editingCo.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
        setSuccess("Co-Scholastic component updated.");
      } else {
        await request<CoScholasticComponent>("/co-scholastic/components", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Co-Scholastic component created for this class.");
      }

      resetCoForm();
      await loadClassSetup(selectedClass);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save Co-Scholastic component."
      );
    } finally {
      setCoSaving(false);
    }
  };

  const deactivateCoComponent = async (
    component: CoScholasticComponent
  ) => {
    if (!selectedClass) return;

    if (!window.confirm(`Deactivate "${component.name}"?`)) return;

    setError("");
    setSuccess("");

    try {
      await request(
        `/co-scholastic/components/${component.id}`,
        { method: "DELETE" }
      );
      setSuccess(`"${component.name}" was deactivated.`);
      await loadClassSetup(selectedClass);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to deactivate component."
      );
    }
  };

  const assignTeacher = async () => {
    if (!selectedSectionId || !selectedSubjectId || !selectedTeacherId) {
      setError("Select a section, subject and teacher.");
      return;
    }

    setAssignmentSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingAssignment) {
        await request<SectionSubjectTeacher>(
          `/sections/${selectedSectionId}/subject-teachers/${editingAssignment.id}`,
          {
            method: "PUT",
            body: JSON.stringify({ teacher_id: Number(selectedTeacherId) }),
          }
        );
        setSuccess("Section subject teacher updated.");
      } else {
        await request<SectionSubjectTeacher>(
          `/sections/${selectedSectionId}/subject-teachers`,
          {
            method: "POST",
            body: JSON.stringify({
              section_id: selectedSectionId,
              subject_id: Number(selectedSubjectId),
              teacher_id: Number(selectedTeacherId),
            }),
          }
        );
        setSuccess("Teacher assigned to the section subject.");
      }

      setSelectedSubjectId("");
      setSelectedTeacherId("");
      setEditingAssignment(null);
      await loadSectionAcademics(selectedSectionId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to save teacher assignment."
      );
    } finally {
      setAssignmentSaving(false);
    }
  };

  const editTeacherAssignment = (assignment: SectionSubjectTeacher) => {
    setEditingAssignment(assignment);
    setSelectedSubjectId(String(assignment.subject_id));
    setSelectedTeacherId(String(assignment.teacher_id));
    setError("");
  };

  const removeTeacherAssignment = async (
    assignment: SectionSubjectTeacher
  ) => {
    if (!selectedSectionId) return;

    const subject = subjectById.get(assignment.subject_id);
    const teacher = teacherById.get(assignment.teacher_id);

    if (
      !window.confirm(
        `Remove ${teacher ? fullName(teacher) : "this teacher"} from ${
          subject?.name ?? "this subject"
        } in ${selectedSection?.name ?? "this section"}?`
      )
    ) {
      return;
    }

    setAssignmentSaving(true);
    setError("");
    setSuccess("");

    try {
      await request(
        `/sections/${selectedSectionId}/subject-teachers/${assignment.id}`,
        { method: "DELETE" }
      );

      setSuccess("Teacher assignment removed.");
      if (editingAssignment?.id === assignment.id) {
        setEditingAssignment(null);
        setSelectedSubjectId("");
        setSelectedTeacherId("");
      }
      await loadSectionAcademics(selectedSectionId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove teacher assignment."
      );
    } finally {
      setAssignmentSaving(false);
    }
  };

  const savePeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const number = Number(periodForm.period_number);
    const name = periodForm.name.trim();

    if (!Number.isInteger(number) || number <= 0 || !name) {
      setError("Period number and name are required.");
      return;
    }

    if (!periodForm.start_time || !periodForm.end_time) {
      setError("Start and end time are required.");
      return;
    }

    if (periodForm.end_time <= periodForm.start_time) {
      setError("End time must be later than start time.");
      return;
    }

    setPeriodSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        period_number: number,
        name,
        start_time: periodForm.start_time,
        end_time: periodForm.end_time,
        is_break: periodForm.is_break,
      };

      if (editingPeriod) {
        await request<TimetablePeriod>(`/timetable/periods/${editingPeriod.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Period updated successfully.");
      } else {
        await request<TimetablePeriod>(`/timetable/periods`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Period created successfully.");
      }

      resetPeriodForm();
      const periodData = await request<TimetablePeriod[]>(`/timetable/periods`);
      setPeriods(Array.isArray(periodData) ? periodData : []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to save timetable period."
      );
    } finally {
      setPeriodSaving(false);
    }
  };

  const editPeriod = (period: TimetablePeriod) => {
    setEditingPeriod(period);
    setPeriodForm({
      period_number: String(period.period_number),
      name: period.name,
      start_time: period.start_time.slice(0, 5),
      end_time: period.end_time.slice(0, 5),
      is_break: period.is_break,
    });
    setError("");
  };

  const resetPeriodForm = () => {
    setEditingPeriod(null);
    setPeriodForm({
      period_number: "",
      name: "",
      start_time: "",
      end_time: "",
      is_break: false,
    });
  };

  const deactivatePeriod = async (period: TimetablePeriod) => {
    if (!window.confirm(`Deactivate ${period.name}?`)) return;

    setPeriodSaving(true);
    setError("");
    setSuccess("");

    try {
      await request(`/timetable/periods/${period.id}`, { method: "DELETE" });
      setSuccess(`${period.name} was deactivated.`);
      const periodData = await request<TimetablePeriod[]>(`/timetable/periods`);
      setPeriods(Array.isArray(periodData) ? periodData : []);
      if (editingPeriod?.id === period.id) resetPeriodForm();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to deactivate period."
      );
    } finally {
      setPeriodSaving(false);
    }
  };

  const saveTimetable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSectionId || !timetableForm.period_id) {
      setError("Select a section and timetable period.");
      return;
    }

    const period = periods.find(
      (item) => item.id === Number(timetableForm.period_id)
    );

    if (!period) {
      setError("Selected timetable period could not be found.");
      return;
    }

    const isBreak = period.is_break;

    if (!isBreak && (!timetableForm.subject_id || !timetableForm.teacher_id)) {
      setError("Subject and teacher are required for a non-break period.");
      return;
    }

    setTimetableSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        period_id: Number(timetableForm.period_id),
        day_of_week: Number(timetableForm.day_of_week),
        subject_id: isBreak ? null : Number(timetableForm.subject_id),
        teacher_id: isBreak ? null : Number(timetableForm.teacher_id),
        room_number: timetableForm.room_number.trim() || null,
      };

      if (editingTimetableEntry) {
        await request<SectionTimetableRow>(
          `/sections/${selectedSectionId}/timetable/${editingTimetableEntry.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
        setSuccess("Section timetable entry updated.");
      } else {
        await request<SectionTimetableRow>(
          `/sections/${selectedSectionId}/timetable`,
          {
            method: "POST",
            body: JSON.stringify({
              section_id: selectedSectionId,
              ...payload,
            }),
          }
        );
        setSuccess("Section timetable entry added.");
      }

      resetTimetableForm();
      await loadSectionAcademics(selectedSectionId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to save timetable entry."
      );
    } finally {
      setTimetableSaving(false);
    }
  };

  const editTimetableEntry = (entry: SectionTimetableRow) => {
    setEditingTimetableEntry(entry);
    setTimetableForm({
      period_id: String(entry.period_id),
      day_of_week: String(entry.day_of_week),
      subject_id: entry.subject_id ? String(entry.subject_id) : "",
      teacher_id: entry.teacher_id ? String(entry.teacher_id) : "",
      room_number: entry.room_number ?? "",
    });
    setError("");
  };

  const deactivateTimetableEntry = async (entry: SectionTimetableRow) => {
    if (!selectedSectionId) return;
    if (!window.confirm("Deactivate this timetable entry?")) return;

    setTimetableSaving(true);
    setError("");
    setSuccess("");

    try {
      await request(
        `/sections/${selectedSectionId}/timetable/${entry.id}`,
        { method: "DELETE" }
      );
      setSuccess("Timetable entry deactivated.");
      resetTimetableForm();
      await loadSectionAcademics(selectedSectionId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to deactivate timetable entry."
      );
    } finally {
      setTimetableSaving(false);
    }
  };

  const resetTimetableForm = () => {
    setEditingTimetableEntry(null);
    setTimetableForm({
      period_id: "",
      day_of_week: "1",
      subject_id: "",
      teacher_id: "",
      room_number: "",
    });
  };

  const closeSetup = () => {
    setSelectedClass(null);
    setSections([]);
    setSelectedSectionId(null);
    setEditingSection(null);
    setSectionForm({ name: "", class_teacher_id: "" });
    setAssignedSubjects([]);
    setCoComponents([]);
    setClassStudents([]);
    setSectionAssignments([]);
    setSectionTimetable([]);
    setPeriods([]);
    setEditingAssignment(null);
    setEditingPeriod(null);
    setEditingTimetableEntry(null);
    resetPeriodForm();
    resetTimetableForm();
    resetCoForm();
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[76px] items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
              EduOS · Academic Management
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#102a56]">
              Classes
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage classes and configure their complete academic setup.
            </p>
          </div>

          <button
            onClick={openCreateClass}
            className="flex items-center gap-2 rounded-xl bg-[#102a56] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#183d73]"
          >
            <span className="text-lg leading-none">+</span>
            Add Class
          </button>
        </div>
      </header>

      <main className="px-6 py-7 lg:px-8">
        <div className="mx-auto max-w-[1550px]">
          <div className="mb-6 flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => router.push("/dashboard")}
              className="transition hover:text-[#315b9b]"
            >
              Dashboard
            </button>
            <span>›</span>
            <span className="font-medium text-slate-600">Classes</span>
          </div>

          {success && (
            <Alert
              tone="success"
              message={success}
              onClose={() => setSuccess("")}
            />
          )}

          {error && !selectedClass && (
            <Alert
              tone="error"
              message={error}
              onClose={() => setError("")}
            />
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <OverviewCard
              title="Total Classes"
              value={classes.length}
              description="Class records"
              icon="▤"
            />
            <OverviewCard
              title="Active Classes"
              value={activeClasses}
              description="Currently active"
              icon="✓"
              green
            />
            <OverviewCard
              title="Inactive Classes"
              value={inactiveClasses}
              description="Inactive records"
              icon="—"
              red
            />
          </section>

          <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 lg:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
                    Academic Structure
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#102a56]">
                    Class Directory
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Open a class to manage students, main subjects,
                    co-scholastic setup, teachers and timetable.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      ⌕
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search classes..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-64"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="all">All Status</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <LoadingTable />
              ) : filteredClasses.length === 0 ? (
                <EmptyState search={search} onAdd={openCreateClass} />
              ) : (
                <table className="min-w-[1050px] w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Class
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Description
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Students
                      </th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClasses.map((schoolClass) => {
                      const studentCount = students.filter(
                        (student) =>
                          student.class_id === schoolClass.id &&
                          student.is_active
                      ).length;

                      return (
                        <tr
                          key={schoolClass.id}
                          className="group border-b border-slate-100 transition hover:bg-blue-50/30"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102a56] text-sm font-bold text-white">
                                {schoolClass.name
                                  .replace("Class", "")
                                  .trim()
                                  .slice(0, 2)
                                  .toUpperCase() || "CL"}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {schoolClass.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  Class ID #{schoolClass.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="max-w-[360px] px-6 py-4">
                            <p className="truncate text-sm text-slate-600">
                              {schoolClass.description ||
                                "No description provided"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <StatusBadge active={schoolClass.is_active} />
                          </td>

                          <td className="px-6 py-4">
                            <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">
                              {studentCount} registered
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <ActionButton
                                label="Open Setup"
                                onClick={() =>
                                  void openClassSetup(schoolClass)
                                }
                              />
                              <ActionButton
                                label="Edit"
                                onClick={() => openEditClass(schoolClass)}
                              />
                              {schoolClass.is_active && (
                                <ActionButton
                                  label="Deactivate"
                                  danger
                                  onClick={() =>
                                    void deactivateClass(schoolClass)
                                  }
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && filteredClasses.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  <strong className="text-slate-600">
                    {filteredClasses.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-600">{classes.length}</strong>{" "}
                  classes
                </span>
                <span>EduOS Class Setup</span>
              </div>
            )}
          </section>
        </div>
      </main>

      {showClassForm && (
        <Modal
          title={editingClass ? "Edit Class" : "Add New Class"}
          subtitle={
            editingClass
              ? "Update the class details."
              : "Create a class in the school academic structure."
          }
          onClose={() => {
            setShowClassForm(false);
            resetClassForm();
          }}
        >
          <form onSubmit={handleClassSubmit} className="space-y-5">
            <Field
              label="Class Name"
              required
              value={form.name}
              placeholder="e.g. Class 10"
              onChange={(value) =>
                setForm((previous) => ({ ...previous, name: value }))
              }
            />

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Description
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional description"
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => {
                  setShowClassForm(false);
                  resetClassForm();
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting
                  ? "Saving..."
                  : editingClass
                    ? "Save Changes"
                    : "Create Class"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedClass && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm lg:p-8">
          <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1500px] overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-white px-6 py-5 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#315b9b]">
                    Class Academic Setup
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-[#102a56]">
                    {selectedClass.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Configure everything that belongs to this class.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeSetup}
                  className="self-start rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {(
                  [
                    ["overview", "Overview"],
                    ["sections", "Sections"],
                    ["students", "Students"],
                    ["subjects", "Main Subjects"],
                    ["co-scholastic", "Co-Scholastic"],
                    ["teachers", "Teachers"],
                    ["timetable", "Timetable"],
                  ] as [SetupTab, string][]
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setSetupTab(tab);
                      setError("");
                    }}
                    className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      setupTab === tab
                        ? "bg-[#102a56] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 lg:p-8">
              {setupLoading ? (
                <SetupLoading />
              ) : (
                <>
                  {error && (
                    <Alert
                      tone="error"
                      message={error}
                      onClose={() => setError("")}
                    />
                  )}

                  {setupTab === "overview" && (
                    <OverviewPanel
                      schoolClass={selectedClass}
                      sectionCount={sections.filter((item) => item.is_active).length}
                      studentCount={classStudents.length}
                      subjectCount={assignedSubjects.length}
                      coCount={coComponents.length}
                      teacherCount={new Set(
                        sectionAssignments.map((item) => item.teacher_id)
                      ).size}
                      timetableCount={sectionTimetable.length}
                      onTabChange={setSetupTab}
                    />
                  )}

                  {setupTab === "sections" && (
                    <SectionsPanel
                      sections={sections}
                      students={classStudents}
                      teachers={teachers}
                      selectedSectionId={selectedSectionId}
                      onSelect={handleSectionChange}
                      form={sectionForm}
                      setForm={setSectionForm}
                      editing={editingSection}
                      saving={sectionSaving}
                      onSubmit={(event) => void saveSection(event)}
                      onEdit={editSection}
                      onDelete={(section) => void deactivateSection(section)}
                      onReset={resetSectionForm}
                    />
                  )}

                  {setupTab === "students" && (
                    <StudentsPanel
                      students={
                        selectedSectionId
                          ? classStudents.filter(
                              (student) => student.section_id === selectedSectionId
                            )
                          : classStudents
                      }
                      sectionName={
                        sections.find((item) => item.id === selectedSectionId)?.name
                      }
                      showAllLabel={!selectedSectionId}
                    />
                  )}

                  {setupTab === "subjects" && (
                    <SubjectsPanel
                      assignedSubjects={assignedSubjects}
                      availableSubjects={availableSubjects}
                      selectedSubjectId={selectedSubjectId}
                      setSelectedSubjectId={setSelectedSubjectId}
                      assigning={assignmentSaving}
                      onAssign={() => void assignSubject()}
                      onRemove={(subject) => void removeSubject(subject)}
                    />
                  )}

                  {setupTab === "co-scholastic" && (
                    <CoScholasticPanel
                      components={coComponents}
                      form={coForm}
                      setForm={setCoForm}
                      editing={editingCo}
                      saving={coSaving}
                      onSubmit={(event) => void saveCoComponent(event)}
                      onEdit={editCoComponent}
                      onDelete={(component) =>
                        void deactivateCoComponent(component)
                      }
                      onReset={resetCoForm}
                    />
                  )}

                  {setupTab === "teachers" && (
                    <TeachersPanel
                      sections={sections}
                      selectedSectionId={selectedSectionId}
                      onSectionChange={handleSectionChange}
                      selectedSection={selectedSection}
                      assigned={sectionAssignments}
                      teachers={teachers}
                      subjects={assignedSubjects}
                      selectedSubjectId={selectedSubjectId}
                      selectedTeacherId={selectedTeacherId}
                      setSelectedSubjectId={setSelectedSubjectId}
                      setSelectedTeacherId={setSelectedTeacherId}
                      editing={editingAssignment}
                      saving={assignmentSaving}
                      onAssign={() => void assignTeacher()}
                      onEdit={editTeacherAssignment}
                      onRemove={(assignment) =>
                        void removeTeacherAssignment(assignment)
                      }
                      onReset={() => {
                        setEditingAssignment(null);
                        setSelectedSubjectId("");
                        setSelectedTeacherId("");
                      }}
                      subjectById={subjectById}
                      teacherById={teacherById}
                    />
                  )}

                  {setupTab === "timetable" && (
                    <TimetablePanel
                      sections={sections}
                      selectedSectionId={selectedSectionId}
                      onSectionChange={handleSectionChange}
                      selectedSection={selectedSection}
                      periods={periods}
                      periodForm={periodForm}
                      setPeriodForm={setPeriodForm}
                      editingPeriod={editingPeriod}
                      onSavePeriod={(event) => void savePeriod(event)}
                      onEditPeriod={editPeriod}
                      onDeletePeriod={(period) => void deactivatePeriod(period)}
                      onResetPeriod={resetPeriodForm}
                      periodSaving={periodSaving}
                      editingTimetableEntry={editingTimetableEntry}
                      onEditTimetableEntry={editTimetableEntry}
                      onDeleteTimetableEntry={(entry) =>
                        void deactivateTimetableEntry(entry)
                      }
                      onResetTimetable={resetTimetableForm}
                      rows={sectionTimetable}
                      subjects={assignedSubjects}
                      teachers={teachers}
                      form={timetableForm}
                      setForm={setTimetableForm}
                      saving={timetableSaving}
                      onSubmit={(event) => void saveTimetable(event)}
                      subjectById={subjectById}
                      teacherById={teacherById}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewPanel({
  schoolClass,
  sectionCount,
  studentCount,
  subjectCount,
  coCount,
  teacherCount,
  timetableCount,
  onTabChange,
}: {
  schoolClass: SchoolClass;
  sectionCount: number;
  studentCount: number;
  subjectCount: number;
  coCount: number;
  teacherCount: number;
  timetableCount: number;
  onTabChange: (tab: SetupTab) => void;
}) {
  const cards: Array<[SetupTab, string, number, string]> = [
    ["sections", "Sections", sectionCount, "Class sections"],
    ["students", "Registered Students", studentCount, "Student roster"],
    ["subjects", "Main Subjects", subjectCount, "Academic calculation"],
    ["co-scholastic", "Co-Scholastic", coCount, "Separate evaluation"],
    ["teachers", "Subject Teachers", teacherCount, "Teacher assignments"],
    ["timetable", "Timetable Periods", timetableCount, "Class schedule"],
  ];

  return (
    <div>
      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
          Class Configuration
        </p>
        <h3 className="mt-2 text-xl font-bold text-[#102a56]">
          {schoolClass.name} is the central academic unit
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Main subjects contribute to academic exams, totals, percentage and
          grade. Co-Scholastic components stay separate and are not included in
          academic totals.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(([tab, title, value, description]) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-bold text-[#102a56]">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{description}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <InfoCard
          title="Academic flow"
          items={[
            "Assign Main Subjects to this class.",
            "Assign teachers to those class subjects.",
            "Build the class timetable.",
            "Create sections first, then place students into the correct section.",
            "Use the section roster for attendance and academic processes.",
          ]}
        />
        <InfoCard
          title="Co-Scholastic flow"
          items={[
            "Create class-specific components such as Art & Craft, Music, Sports or Discipline.",
            "Choose MARKS, GRADE or REMARK evaluation.",
            "Co-Scholastic results remain separate from academic percentage.",
            "Report cards can display them in their dedicated section.",
          ]}
        />
      </div>
    </div>
  );
}

function SectionsPanel({
  sections,
  students,
  teachers,
  selectedSectionId,
  onSelect,
  form,
  setForm,
  editing,
  saving,
  onSubmit,
  onEdit,
  onDelete,
  onReset,
}: {
  sections: Section[];
  students: Student[];
  teachers: Teacher[];
  selectedSectionId: number | null;
  onSelect: (id: number | null) => void;
  form: SectionForm;
  setForm: React.Dispatch<React.SetStateAction<SectionForm>>;
  editing: Section | null;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (section: Section) => void;
  onDelete: (section: Section) => void;
  onReset: () => void;
}) {
  const activeSections = sections.filter((section) => section.is_active);

  return (
    <div>
      <SectionHeading
        eyebrow="Class Structure"
        title="Sections"
        description="Create and manage sections inside this class, and assign one class teacher to each section."
      />

      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Field
            label="Section Name"
            required
            value={form.name}
            placeholder="e.g. A"
            onChange={(value) => setForm((previous) => ({ ...previous, name: value }))}
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Class Teacher
            </label>
            <select
              value={form.class_teacher_id}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  class_teacher_id: event.target.value,
                }))
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">No class teacher</option>
              {teachers
                .filter((teacher) => teacher.is_active !== false)
                .map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {fullName(teacher)}
                    {teacher.employee_number ? ` · ${teacher.employee_number}` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="h-11 flex-1 rounded-xl bg-[#102a56] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Section" : "Add Section"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={onReset}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {activeSections.length === 0 ? (
        <EmptyMini text="No active sections configured for this class." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeSections.map((section) => {
            const teacher = section.class_teacher_id
              ? teachers.find((item) => item.id === section.class_teacher_id)
              : null;
            const studentCount = students.filter(
              (student) =>
                student.section_id === section.id && student.is_active
            ).length;

            const selected = selectedSectionId === section.id;

            return (
              <div
                key={section.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                  selected
                    ? "border-blue-300 ring-2 ring-blue-100"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelect(selected ? null : section.id)}
                    className="flex min-w-0 items-center gap-3 text-left"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#102a56] text-sm font-bold text-white">
                      {section.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold text-slate-800">
                        Section {section.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {studentCount} active students
                      </span>
                    </span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(section)}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(section)}
                      disabled={saving}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Class Teacher
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {teacher ? fullName(teacher) : "Not assigned"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelect(selected ? null : section.id)}
                  className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {selected ? "Show class roster" : "View section students"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentsPanel({
  students,
  sectionName,
  showAllLabel,
}: {
  students: Student[];
  sectionName?: string;
  showAllLabel: boolean;
}) {
  return (
    <div>
      <SectionHeading
        eyebrow="Class Roster"
        title={showAllLabel ? "Registered Students" : `Students · Section ${sectionName ?? ""}`}
        description={
          showAllLabel
            ? "Active students currently linked to this class. Select a section from the Sections tab to filter this roster."
            : "Active students currently assigned to the selected section."
        }
      />

      {students.length === 0 ? (
        <EmptyMini text="No active students are registered in this class." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[800px] w-full">
            <thead className="bg-slate-50">
              <tr>
                {["Admission", "Student", "Status", "Student ID"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="border-t border-slate-100 hover:bg-blue-50/30"
                >
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                    {student.admission_number}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800">
                      {fullName(student)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {student.id}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      {student.status || "ACTIVE"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    #{student.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubjectsPanel({
  assignedSubjects,
  availableSubjects,
  selectedSubjectId,
  setSelectedSubjectId,
  assigning,
  onAssign,
  onRemove,
}: {
  assignedSubjects: Subject[];
  availableSubjects: Subject[];
  selectedSubjectId: string;
  setSelectedSubjectId: (value: string) => void;
  assigning: boolean;
  onAssign: () => void;
  onRemove: (subject: Subject) => void;
}) {
  return (
    <div>
      <SectionHeading
        eyebrow="Academic Subjects"
        title="Main Subjects"
        description="These are the subjects that participate in academic exams and result calculations."
      />

      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Available Main Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Select subject</option>
              {availableSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onAssign}
            disabled={assigning || !selectedSubjectId}
            className="h-11 rounded-xl bg-[#102a56] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {assigning ? "Assigning..." : "Assign Subject"}
          </button>
        </div>
      </div>

      {assignedSubjects.length === 0 ? (
        <EmptyMini text="No Main Subjects are assigned to this class yet." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {assignedSubjects.map((subject) => (
            <div
              key={subject.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {subject.name}
                  </p>
                  <span className="mt-1 inline-block rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                    {subject.code}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(subject)}
                  disabled={assigning}
                  className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Counts in academic exams, totals, percentage and grade.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CoScholasticPanel({
  components,
  form,
  setForm,
  editing,
  saving,
  onSubmit,
  onEdit,
  onDelete,
  onReset,
}: {
  components: CoScholasticComponent[];
  form: CoForm;
  setForm: React.Dispatch<React.SetStateAction<CoForm>>;
  editing: CoScholasticComponent | null;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (component: CoScholasticComponent) => void;
  onDelete: (component: CoScholasticComponent) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <SectionHeading
        eyebrow="Separate Evaluation"
        title="Co-Scholastic"
        description="Class-specific evaluation areas. They do not contribute to academic totals or percentage."
      />

      <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-5">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-6">
          <Field
            label="Component Name"
            required
            value={form.name}
            placeholder="e.g. Art & Craft"
            onChange={(value) => setForm((p) => ({ ...p, name: value }))}
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Evaluation Type
            </label>
            <select
              value={form.component_type}
              onChange={(event) =>
                setForm((p) => ({
                  ...p,
                  component_type: event.target.value as CoForm["component_type"],
                }))
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="MARKS">MARKS</option>
              <option value="GRADE">GRADE</option>
              <option value="REMARK">REMARK</option>
            </select>
          </div>

          <Field
            label="Max Marks"
            value={form.max_marks}
            type="number"
            disabled={form.component_type !== "MARKS"}
            placeholder={form.component_type === "MARKS" ? "100" : "N/A"}
            onChange={(value) => setForm((p) => ({ ...p, max_marks: value }))}
          />

          <Field
            label="Display Order"
            value={form.display_order}
            type="number"
            onChange={(value) =>
              setForm((p) => ({ ...p, display_order: value }))
            }
          />

          <label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={form.include_in_result}
              onChange={(event) =>
                setForm((p) => ({
                  ...p,
                  include_in_result: event.target.checked,
                }))
              }
            />
            Show in report result
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="h-11 flex-1 rounded-xl bg-[#102a56] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Update"
                  : "Add Component"}
            </button>

            {editing && (
              <button
                type="button"
                onClick={onReset}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <p className="mt-3 text-xs text-amber-800">
          “Show in report result” controls report-card display only. It does
          not make the component part of academic percentage calculations.
        </p>
      </div>

      {components.length === 0 ? (
        <EmptyMini text="No Co-Scholastic components configured for this class." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[900px] w-full">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Component",
                  "Type",
                  "Max Marks",
                  "Order",
                  "Report",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <tr
                  key={component.id}
                  className="border-t border-slate-100 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {component.name}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700">
                      {component.component_type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {component.max_marks ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {component.display_order}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {component.include_in_result ? "Yes" : "No"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => onEdit(component)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(component)}
                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeachersPanel({
  sections,
  selectedSectionId,
  onSectionChange,
  selectedSection,
  assigned,
  teachers,
  subjects,
  selectedSubjectId,
  selectedTeacherId,
  setSelectedSubjectId,
  setSelectedTeacherId,
  editing,
  saving,
  onAssign,
  onEdit,
  onRemove,
  onReset,
  subjectById,
  teacherById,
}: {
  sections: Section[];
  selectedSectionId: number | null;
  onSectionChange: (value: number | null) => void;
  selectedSection: Section | null;
  assigned: SectionSubjectTeacher[];
  teachers: Teacher[];
  subjects: Subject[];
  selectedSubjectId: string;
  selectedTeacherId: string;
  setSelectedSubjectId: (value: string) => void;
  setSelectedTeacherId: (value: string) => void;
  editing: SectionSubjectTeacher | null;
  saving: boolean;
  onAssign: () => void;
  onEdit: (assignment: SectionSubjectTeacher) => void;
  onRemove: (assignment: SectionSubjectTeacher) => void;
  onReset: () => void;
  subjectById: Map<number, Subject>;
  teacherById: Map<number, Teacher>;
}) {
  const activeSections = sections.filter((section) => section.is_active);
  const activeAssignments = assigned.filter((item) => item.is_active);

  return (
    <div>
      <SectionHeading
        eyebrow="Teaching Structure"
        title="Section Subject Teachers"
        description="Assign one teacher mapping per Main Subject inside the selected section."
      />

      <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Section
        </label>
        <select
          value={selectedSectionId ? String(selectedSectionId) : ""}
          onChange={(event) =>
            onSectionChange(event.target.value ? Number(event.target.value) : null)
          }
          className="mb-5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Select section</option>
          {activeSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>

        {!selectedSectionId ? (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">
            Create and select a section before assigning subject teachers.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <SelectMini
              label="Main Subject"
              value={selectedSubjectId}
              onChange={setSelectedSubjectId}
              options={subjects.map((subject) => ({
                value: String(subject.id),
                label: `${subject.name} (${subject.code})`,
              }))}
              placeholder="Select subject"
            />
            <SelectMini
              label="Teacher"
              value={selectedTeacherId}
              onChange={setSelectedTeacherId}
              options={teachers
                .filter((teacher) => teacher.is_active !== false)
                .map((teacher) => ({
                  value: String(teacher.id),
                  label: fullName(teacher),
                }))}
              placeholder="Select teacher"
            />
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={onAssign}
                disabled={saving || !selectedSubjectId || !selectedTeacherId}
                className="h-11 flex-1 rounded-xl bg-[#102a56] px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : editing ? "Update Teacher" : "Assign Teacher"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={onReset}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedSectionId && activeAssignments.length === 0 ? (
        <EmptyMini
          text={`No subject teachers are assigned to ${selectedSection?.name ?? "this section"} yet.`}
        />
      ) : selectedSectionId ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[900px] w-full">
            <thead className="bg-slate-50">
              <tr>
                {["Subject", "Teacher", "Employee", "Status", "Actions"].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeAssignments.map((assignment) => {
                const teacher = teacherById.get(assignment.teacher_id);
                const subject = subjectById.get(assignment.subject_id);

                return (
                  <tr key={assignment.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {subject
                        ? `${subject.name} (${subject.code})`
                        : `Subject #${assignment.subject_id}`}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {teacher ? fullName(teacher) : `Teacher #${assignment.teacher_id}`}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {teacher?.employee_number || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={assignment.is_active} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => onEdit(assignment)}
                          disabled={saving}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(assignment)}
                          disabled={saving}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedSectionId && activeAssignments.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {new Set(activeAssignments.map((item) => item.teacher_id)).size} unique
          teacher(s) assigned to {selectedSection?.name ?? "this section"}.
        </p>
      )}
    </div>
  );
}

function TimetablePanel({
  sections,
  selectedSectionId,
  onSectionChange,
  selectedSection,
  periods,
  periodForm,
  setPeriodForm,
  editingPeriod,
  onSavePeriod,
  onEditPeriod,
  onDeletePeriod,
  onResetPeriod,
  periodSaving,
  editingTimetableEntry,
  onEditTimetableEntry,
  onDeleteTimetableEntry,
  onResetTimetable,
  rows,
  subjects,
  teachers,
  form,
  setForm,
  saving,
  onSubmit,
  subjectById,
  teacherById,
}: {
  sections: Section[];
  selectedSectionId: number | null;
  onSectionChange: (value: number | null) => void;
  selectedSection: Section | null;
  periods: TimetablePeriod[];
  periodForm: PeriodForm;
  setPeriodForm: React.Dispatch<React.SetStateAction<PeriodForm>>;
  editingPeriod: TimetablePeriod | null;
  onSavePeriod: (event: FormEvent<HTMLFormElement>) => void;
  onEditPeriod: (period: TimetablePeriod) => void;
  onDeletePeriod: (period: TimetablePeriod) => void;
  onResetPeriod: () => void;
  periodSaving: boolean;
  editingTimetableEntry: SectionTimetableRow | null;
  onEditTimetableEntry: (entry: SectionTimetableRow) => void;
  onDeleteTimetableEntry: (entry: SectionTimetableRow) => void;
  onResetTimetable: () => void;
  rows: SectionTimetableRow[];
  subjects: Subject[];
  teachers: Teacher[];
  form: TimetableForm;
  setForm: React.Dispatch<React.SetStateAction<TimetableForm>>;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  subjectById: Map<number, Subject>;
  teacherById: Map<number, Teacher>;
}) {
  const activeSections = sections.filter((section) => section.is_active);
  const activePeriods = periods
    .filter((period) => period.is_active)
    .sort((a, b) => a.period_number - b.period_number);
  const activeRows = rows.filter((row) => row.is_active);
  const selectedPeriod = periods.find(
    (period) => period.id === Number(form.period_id)
  );

  const rowFor = (day: number, periodId: number) =>
    activeRows.find(
      (row) => row.day_of_week === day && row.period_id === periodId
    );

  return (
    <div>
      <SectionHeading
        eyebrow="Section Schedule"
        title="Timetable"
        description="Manage reusable periods, then place each period into the selected section by day, subject, teacher and room."
      />

      <div className="mb-6 rounded-2xl border border-violet-100 bg-violet-50 p-5">
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Section
        </label>
        <select
          value={selectedSectionId ? String(selectedSectionId) : ""}
          onChange={(event) =>
            onSectionChange(event.target.value ? Number(event.target.value) : null)
          }
          className="mb-5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Select section</option>
          {activeSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>

        <div className="rounded-2xl border border-white/80 bg-white p-4">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#102a56]">Period Master</p>
              <p className="text-xs text-slate-500">
                Define reusable time slots once for the school.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {activePeriods.length} active period(s)
            </span>
          </div>

          <form
            onSubmit={onSavePeriod}
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6"
          >
            <Field
              label="Period #"
              type="number"
              value={periodForm.period_number}
              onChange={(value) =>
                setPeriodForm((previous) => ({
                  ...previous,
                  period_number: value,
                }))
              }
              required
            />
            <Field
              label="Name"
              value={periodForm.name}
              placeholder="e.g. Period 1 / Break"
              onChange={(value) =>
                setPeriodForm((previous) => ({ ...previous, name: value }))
              }
              required
            />
            <Field
              label="Start"
              type="time"
              value={periodForm.start_time}
              onChange={(value) =>
                setPeriodForm((previous) => ({
                  ...previous,
                  start_time: value,
                }))
              }
              required
            />
            <Field
              label="End"
              type="time"
              value={periodForm.end_time}
              onChange={(value) =>
                setPeriodForm((previous) => ({
                  ...previous,
                  end_time: value,
                }))
              }
              required
            />
            <label className="flex h-11 items-center gap-2 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={periodForm.is_break}
                onChange={(event) =>
                  setPeriodForm((previous) => ({
                    ...previous,
                    is_break: event.target.checked,
                  }))
                }
              />
              Break
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={periodSaving}
                className="h-11 flex-1 rounded-xl bg-[#102a56] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {periodSaving
                  ? "Saving..."
                  : editingPeriod
                    ? "Update Period"
                    : "Add Period"}
              </button>
              {editingPeriod && (
                <button
                  type="button"
                  onClick={onResetPeriod}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
                >
                  Reset
                </button>
              )}
            </div>
          </form>

          {activePeriods.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[720px] w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {["#", "Period", "Time", "Type", "Actions"].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activePeriods.map((period) => (
                    <tr key={period.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">
                        {period.period_number}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                        {period.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {period.start_time.slice(0, 5)} – {period.end_time.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                        {period.is_break ? "Break" : "Teaching"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => onEditPeriod(period)}
                            disabled={periodSaving}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePeriod(period)}
                            disabled={periodSaving}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {!selectedSectionId ? (
        <EmptyMini text="Select a section to configure its timetable." />
      ) : activePeriods.length === 0 ? (
        <EmptyMini text="Create at least one active period before building the section timetable." />
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="mb-4">
              <p className="text-sm font-bold text-[#102a56]">
                Add Timetable Entry
              </p>
              <p className="text-xs text-slate-500">
                {selectedSection?.name ?? "Selected section"} · choose a reusable period and day.
              </p>
            </div>

            <form
              onSubmit={onSubmit}
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
            >
              <SelectMini
                label="Period"
                value={form.period_id}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    period_id: value,
                    subject_id: "",
                    teacher_id: "",
                  }))
                }
                options={activePeriods.map((period) => ({
                  value: String(period.id),
                  label: `${period.period_number}. ${period.name} · ${period.start_time.slice(0, 5)}-${period.end_time.slice(0, 5)}`,
                }))}
                placeholder="Select period"
              />
              <SelectMini
                label="Day"
                value={form.day_of_week}
                onChange={(value) =>
                  setForm((previous) => ({ ...previous, day_of_week: value }))
                }
                options={[1, 2, 3, 4, 5, 6, 7].map((day) => ({
                  value: String(day),
                  label: dayName(day),
                }))}
              />
              <SelectMini
                label="Subject"
                value={form.subject_id}
                onChange={(value) =>
                  setForm((previous) => ({ ...previous, subject_id: value }))
                }
                options={subjects.map((subject) => ({
                  value: String(subject.id),
                  label: subject.name,
                }))}
                placeholder={
                  selectedPeriod?.is_break
                    ? "Not used for break"
                    : "Select subject"
                }
              />
              <SelectMini
                label="Teacher"
                value={form.teacher_id}
                onChange={(value) =>
                  setForm((previous) => ({ ...previous, teacher_id: value }))
                }
                options={teachers
                  .filter((teacher) => teacher.is_active !== false)
                  .map((teacher) => ({
                    value: String(teacher.id),
                    label: fullName(teacher),
                  }))}
                placeholder={
                  selectedPeriod?.is_break
                    ? "Not used for break"
                    : "Select teacher"
                }
              />
              <Field
                label="Room"
                value={form.room_number}
                placeholder="e.g. 12"
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    room_number: value,
                  }))
                }
              />
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 flex-1 rounded-xl bg-[#102a56] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingTimetableEntry
                      ? "Update Entry"
                      : "Add Entry"}
                </button>
                {editingTimetableEntry && (
                  <button
                    type="button"
                    onClick={onResetTimetable}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {selectedPeriod?.is_break && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-amber-700">
                Break selected: subject and teacher are not required.
              </p>
            )}
          </div>

          {activeRows.length === 0 ? (
            <EmptyMini
              text={`No timetable entries are configured for ${selectedSection?.name ?? "this section"}.`}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1250px] w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Period
                    </th>
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                      <th
                        key={day}
                        className="min-w-[155px] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400"
                      >
                        {dayName(day)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activePeriods.map((period) => (
                    <tr key={period.id} className="border-t border-slate-100">
                      <td className="bg-slate-50 px-4 py-4 align-top">
                        <p className="text-sm font-bold text-slate-800">
                          {period.period_number}. {period.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {period.start_time.slice(0, 5)} – {period.end_time.slice(0, 5)}
                        </p>
                        {period.is_break && (
                          <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
                            BREAK
                          </span>
                        )}
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                        const row = rowFor(day, period.id);
                        const subject = row?.subject_id
                          ? subjectById.get(row.subject_id)
                          : undefined;
                        const teacher = row?.teacher_id
                          ? teacherById.get(row.teacher_id)
                          : undefined;

                        return (
                          <td key={`${period.id}-${day}`} className="px-3 py-3 align-top">
                            {row ? (
                              <div className="min-h-[92px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                {period.is_break ? (
                                  <p className="text-sm font-bold text-amber-700">
                                    {period.name}
                                  </p>
                                ) : (
                                  <>
                                    <p className="text-sm font-bold text-[#102a56]">
                                      {subject?.name ?? `Subject #${row.subject_id}`}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">
                                      {teacher
                                        ? fullName(teacher)
                                        : row.teacher_id
                                          ? `Teacher #${row.teacher_id}`
                                          : "No teacher"}
                                    </p>
                                  </>
                                )}
                                <p className="mt-2 text-[11px] text-slate-400">
                                  Room {row.room_number || "—"}
                                </p>
                                <div className="mt-2 flex gap-3">
                                  <button
                                    type="button"
                                    onClick={() => onEditTimetableEntry(row)}
                                    disabled={saving}
                                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTimetableEntry(row)}
                                    disabled={saving}
                                    className="text-[11px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                                  >
                                    Deactivate
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex min-h-[92px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-300">
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-xl font-bold text-[#102a56]">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h4 className="font-bold text-[#102a56]">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-sm leading-6 text-slate-600"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        type={type}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      />
    </div>
  );
}

function SelectMini({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#315b9b]">
              Academic Management
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#102a56]">{title}</h2>
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Alert({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const classes =
    tone === "success"
      ? "mb-5 border-emerald-200 bg-emerald-50 text-emerald-700"
      : "mb-5 border-red-200 bg-red-50 text-red-700";

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-5 py-3 text-sm font-medium ${classes}`}
    >
      <span>{message}</span>
      <button type="button" onClick={onClose} className="ml-4 opacity-70">
        ×
      </button>
    </div>
  );
}

function OverviewCard({
  title,
  value,
  description,
  icon,
  green = false,
  red = false,
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
  green?: boolean;
  red?: boolean;
}) {
  let iconClass = "bg-slate-100 text-slate-700";

  if (green) iconClass = "bg-emerald-50 text-emerald-700";
  if (red) iconClass = "bg-red-50 text-red-700";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-50" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[#102a56]">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function LoadingTable() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-2 w-28 rounded bg-slate-100" />
          </div>
          <div className="hidden h-8 w-40 rounded bg-slate-100 md:block" />
          <div className="h-8 w-28 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function SetupLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-slate-200 p-5">
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="mt-4 h-8 w-16 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  search,
  onAdd,
}: {
  search: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#102a56]">
        ▤
      </div>
      <h3 className="mt-5 text-lg font-bold text-[#102a56]">
        {search ? "No classes found" : "No classes yet"}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {search
          ? "Try changing your search or status filter."
          : "Start building your academic structure by adding the first class."}
      </p>
      {!search && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 rounded-xl bg-[#102a56] px-5 py-2.5 text-sm font-semibold text-white"
        >
          + Add Class
        </button>
      )}
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
