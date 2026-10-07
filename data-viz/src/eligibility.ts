import type { School, CandidateProfile } from "./types";

const CREDIT_HOURS_PER_SEMESTER = 4;

export type EligibilityStatus = "eligible" | "ineligible" | "unknown";

/** Whether the candidate has entered any coursework to use as an eligibility filter. */
export function hasCoursework(profile: CandidateProfile): boolean {
  return Object.values(profile.semestersBySubject).some((semesters) => semesters > 0);
}

/** Determines whether the candidate meets known requirements, fails, or has unknown requirements. */
export function getEligibilityStatus(school: School, profile: CandidateProfile): EligibilityStatus {
  if (!school.msar.prerequisite_courses || school.msar.prerequisite_courses.length === 0) {
    return "unknown";
  }

  const requiredHoursByCode = new Map<string, number>();
  let hasUnknownRequirement = false;

  for (const course of school.msar.prerequisite_courses) {
    if (course.required_or_recommended !== "Required") continue;
    if (course.credit_hours === null || !Number.isFinite(course.credit_hours)) {
      hasUnknownRequirement = true;
      continue;
    }
    requiredHoursByCode.set(
      course.class_code,
      (requiredHoursByCode.get(course.class_code) ?? 0) + course.credit_hours
    );
  }

  if (hasUnknownRequirement) return "unknown";

  for (const [code, requiredHours] of requiredHoursByCode) {
    const candidateHours = (profile.semestersBySubject[code] ?? 0) * CREDIT_HOURS_PER_SEMESTER;
    if (candidateHours < requiredHours) {
      return "ineligible";
    }
  }
  return "eligible";
}

/** Explain when prerequisite data is insufficient to assess a school. */
export function getSchoolDataIssue(school: School): string | null {
  const courses = school.msar?.prerequisite_courses;
  if (!courses || courses.length === 0) {
    return "No prerequisite course data is available.";
  }

  const hasMissingRequiredHours = courses.some(
    (course) =>
      course.required_or_recommended === "Required" &&
      (course.credit_hours == null || !Number.isFinite(course.credit_hours))
  );
  return hasMissingRequiredHours
    ? "One or more required credit-hour values are missing."
    : null;
}

/** Boolean convenience for callers that only need confirmed eligibility. */
export function isEligible(school: School, profile: CandidateProfile): boolean {
  return getEligibilityStatus(school, profile) === "eligible";
}

export type SubjectRequirementStatus = "met" | "unmet" | "unknown" | "not-required";

/** Compare a candidate's subject total with all known required hours for that subject. */
export function getSubjectRequirementStatus(
  school: School,
  profile: CandidateProfile,
  classCode: string
): SubjectRequirementStatus {
  const requiredCourses = school.msar.prerequisite_courses.filter(
    (course) => course.required_or_recommended === "Required" && course.class_code === classCode
  );
  if (requiredCourses.length === 0) return "not-required";
  if (requiredCourses.some((course) => course.credit_hours == null || !Number.isFinite(course.credit_hours))) {
    return "unknown";
  }

  const requiredHours = requiredCourses.reduce((total, course) => total + course.credit_hours!, 0);
  const candidateHours = (profile.semestersBySubject[classCode] ?? 0) * CREDIT_HOURS_PER_SEMESTER;
  return candidateHours >= requiredHours ? "met" : "unmet";
}

/** Resolve state abbreviation for a school */
export function getStateAbbr(school: School): string {
  return school.state.msar || school.state.deadlines || "";
}

/** Map full state name → abbreviation for US states */
const STATE_NAME_TO_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
  "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA",
  Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
  "District of Columbia": "DC", "Puerto Rico": "PR",
};

/** Map Canadian province name → abbreviation */
const PROVINCE_NAME_TO_ABBR: Record<string, string> = {
  "British Columbia": "BC", Alberta: "AB", Saskatchewan: "SK", Manitoba: "MB",
  Ontario: "ON", Quebec: "QC", "New Brunswick": "NB", "Nova Scotia": "NS",
  "Prince Edward Island": "PE", "Newfoundland and Labrador": "NL",
  "Northwest Territories": "NT", Nunavut: "NU", Yukon: "YT",
};

export function regionNameToAbbr(name: string): string {
  return STATE_NAME_TO_ABBR[name] || PROVINCE_NAME_TO_ABBR[name] || name;
}
