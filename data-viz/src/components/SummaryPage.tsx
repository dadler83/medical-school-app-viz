import { useMemo, useState } from "react";
import { getEligibilityStatus, getSchoolDataIssue, hasCoursework } from "../eligibility";
import type { CandidateProfile, School } from "../types";
import SchoolList from "./SchoolList";

type SummaryCategory = "eligible" | "ineligible" | "data-issues";

interface Props {
  schools: School[];
  profile: CandidateProfile;
}

export default function SummaryPage({ schools, profile }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<SummaryCategory | null>(null);
  const hasCourseworkInput = hasCoursework(profile);

  const schoolGroups = useMemo(() => {
    const eligible: School[] = [];
    const ineligible: School[] = [];
    const dataIssues: School[] = [];

    for (const school of schools) {
      const hasDataIssue = getSchoolDataIssue(school) !== null;
      if (hasDataIssue) {
        dataIssues.push(school);
      } else if (hasCoursework(profile)) {
        const status = getEligibilityStatus(school, profile);
        if (status === "eligible") eligible.push(school);
        if (status === "ineligible") ineligible.push(school);
      }
    }

    const sortByName = (left: School, right: School) => left.school_name.localeCompare(right.school_name);
    eligible.sort(sortByName);
    ineligible.sort(sortByName);
    dataIssues.sort(sortByName);
    return { eligible, ineligible, dataIssues };
  }, [schools, profile]);

  const selectedSchools = selectedCategory === "eligible"
    ? schoolGroups.eligible
    : selectedCategory === "ineligible"
      ? schoolGroups.ineligible
      : selectedCategory === "data-issues"
        ? schoolGroups.dataIssues
        : [];
  const selectedTitle = selectedCategory === "data-issues"
    ? "Schools with data issues"
    : selectedCategory === "eligible"
      ? "Eligible schools"
      : "Ineligible schools";

  const cards: {
    category: SummaryCategory;
    title: string;
    count: number | string;
    description: string;
    tone: string;
    available: boolean;
  }[] = [
    {
      category: "eligible",
      title: "Eligible to apply",
      count: hasCourseworkInput ? schoolGroups.eligible.length : "—",
      description: hasCourseworkInput ? "Meets all known required course hours" : "Enter coursework to calculate",
      tone: "eligible",
      available: hasCourseworkInput,
    },
    {
      category: "ineligible",
      title: "Ineligible",
      count: hasCourseworkInput ? schoolGroups.ineligible.length : "—",
      description: hasCourseworkInput ? "Below one or more known course-hour requirements" : "Enter coursework to calculate",
      tone: "ineligible",
      available: hasCourseworkInput,
    },
    {
      category: "data-issues",
      title: "Schools with data issues",
      count: schoolGroups.dataIssues.length,
      description: "Missing or incomplete prerequisite data",
      tone: "data-issues",
      available: true,
    },
  ];

  return (
    <div className="summary-page">
      <div className="summary-heading">
        <p className="eyebrow">YOUR APPLICATION SNAPSHOT</p>
        <h2>School eligibility summary</h2>
        <p>
          {schools.length} medical schools in the dataset. Results update as you change your coursework in Your Profile.
        </p>
      </div>

      {!hasCourseworkInput && (
        <div className="summary-notice" role="status">
          Enter at least one completed semester by subject to calculate eligible and ineligible schools. Schools with incomplete prerequisite data are counted separately.
        </div>
      )}

      <div className="summary-cards" aria-label="School eligibility counts">
        {cards.map((card) => (
          <button
            key={card.category}
            type="button"
            className={`summary-card ${card.tone}${selectedCategory === card.category ? " selected" : ""}`}
            disabled={!card.available}
            aria-expanded={selectedCategory === card.category}
            onClick={() => setSelectedCategory((current) => current === card.category ? null : card.category)}
          >
            <span className="summary-card-label">{card.title}</span>
            <span className="summary-card-count">{card.count}</span>
            <span className="summary-card-description">{card.description}</span>
            <span className="summary-card-action">{card.available ? "Click to view schools" : "Coursework required"}</span>
          </button>
        ))}
      </div>

      {selectedCategory && (
        <div className="summary-school-list">
          <SchoolList
            regionName={selectedTitle}
            schools={selectedSchools}
            profile={profile}
            groupByEligibility={false}
            onClose={() => setSelectedCategory(null)}
          />
        </div>
      )}
    </div>
  );
}
