import type { School, CandidateProfile } from "./types";

/**
 * Determines if a candidate meets the *required* prerequisite courses for a school.
 * A school is eligible if every required course's class_code is in the candidate's coursesTaken set.
 */
export function isEligible(school: School, profile: CandidateProfile): boolean {
  const requiredCodes = new Set(
    school.msar.prerequisite_courses
      .filter((c) => c.required_or_recommended === "Required")
      .map((c) => c.class_code)
  );

  for (const code of requiredCodes) {
    if (!profile.coursesTaken.has(code)) {
      return false;
    }
  }
  return true;
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
