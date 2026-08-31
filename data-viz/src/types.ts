export interface PrerequisiteCourse {
  course: string;
  class_code: string;
  required_or_recommended: "Required" | "Recommended";
  credit_hours: number;
  notes: string;
}

export interface SchoolState {
  msar?: string;
  deadlines?: string;
}

export interface SchoolStatistics {
  source_school_name: string;
  state: string;
  applications_total: number;
  applications_in_state_pct: number;
  applications_out_of_state_pct: number;
  applications_men_pct: number;
  applications_women_pct: number;
  matriculants_total: number;
  matriculants_in_state_pct: number;
  matriculants_out_of_state_pct: number;
  matriculants_men_pct: number;
  matriculants_women_pct: number;
}

export interface School {
  school_name: string;
  state: SchoolState;
  application: {
    application_deadline: string;
    criminal_background_check: string;
  };
  msar: {
    source_pages: number[];
    prerequisite_courses: PrerequisiteCourse[];
    page_notes: string[];
  };
  statistics: {
    md: SchoolStatistics;
    md_phd: SchoolStatistics;
  };
}

export interface SchoolData {
  metadata: Record<string, unknown>;
  schools: Record<string, School>;
}

export interface CandidateProfile {
  coursesTaken: Set<string>;
  gpa: number | null;
}

export const COURSE_OPTIONS: { code: string; label: string }[] = [
  { code: "BIOL", label: "Biology" },
  { code: "CHEM", label: "Chemistry" },
  { code: "PHYS", label: "Physics" },
  { code: "MATH", label: "Mathematics" },
  { code: "ENGL", label: "English" },
  { code: "BESS", label: "Behavioral/Social Sciences" },
];
