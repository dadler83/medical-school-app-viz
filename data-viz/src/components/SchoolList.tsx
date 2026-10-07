import type { School, CandidateProfile } from "../types";
import { getEligibilityStatus, getSchoolDataIssue, getSubjectRequirementStatus, hasCoursework } from "../eligibility";

interface Props {
  regionName: string;
  schools: School[];
  profile: CandidateProfile;
  onClose: () => void;
  groupByEligibility?: boolean;
}

export default function SchoolList({ regionName, schools, profile, onClose, groupByEligibility = true }: Props) {
  const hasFilters = hasCoursework(profile);
  const schoolEntries = schools.map((school) => ({
    school,
    status: getEligibilityStatus(school, profile),
    dataIssue: getSchoolDataIssue(school),
  }));
  const eligibleSchools = schoolEntries.filter(({ status }) => status === "eligible");
  const ineligibleSchools = schoolEntries.filter(({ status }) => status === "ineligible");
  const unknownSchools = schoolEntries.filter(({ status }) => status === "unknown");
  const sections = !groupByEligibility && schoolEntries.length > 0
    ? [{ title: `${regionName} (${schoolEntries.length})`, entries: schoolEntries }]
    : groupByEligibility && hasFilters
    ? [
        { title: `Eligible (${eligibleSchools.length})`, entries: eligibleSchools },
        { title: `Ineligible (${ineligibleSchools.length})`, entries: ineligibleSchools },
        { title: `Eligibility unknown (${unknownSchools.length})`, entries: unknownSchools },
      ].filter(({ entries }) => entries.length > 0)
    : groupByEligibility
      ? [{ title: `Schools (${schoolEntries.length})`, entries: schoolEntries }]
      : [];

  return (
    <div className="school-list-panel">
      <div className="panel-header">
        <h2>{regionName}</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <p className="school-count">
        {!groupByEligibility
          ? `${schools.length} school${schools.length !== 1 ? "s" : ""}`
          : hasFilters
          ? `${eligibleSchools.length} eligible · ${ineligibleSchools.length} ineligible · ${unknownSchools.length} unknown of ${schools.length} schools`
          : `${schools.length} school${schools.length !== 1 ? "s" : ""}`}
      </p>
      {groupByEligibility && hasFilters && unknownSchools.length > 0 && (
        <p className="eligibility-note">Unknown schools remain listed but are not counted as eligible.</p>
      )}
      {schools.length === 0 && (
        <p className="no-results">{groupByEligibility ? "No schools found in this region." : "No schools in this category."}</p>
      )}
      {sections.map(({ title, entries }) => (
        <section className="school-group" key={title}>
          <h3>{title}</h3>
          <ul className="school-cards">
            {entries.map(({ school: s, dataIssue }) => (
              <li key={s.school_name} className="school-card">
                <h3>{s.school_name}</h3>
                {dataIssue && (
                  <p className="eligibility-badge unknown">Prerequisite data issue: {dataIssue}</p>
                )}
                <div className="school-meta">
                  <span>Deadline: {s.application.application_deadline || "N/A"}</span>
                  {s.statistics?.md?.matriculants_total > 0 && (
                    <span>Matriculants: {s.statistics.md.matriculants_total}</span>
                  )}
                  {s.statistics?.md?.applications_total > 0 && (
                    <span>Applicants: {s.statistics.md.applications_total.toLocaleString()}</span>
                  )}
                </div>
                {s.msar.prerequisite_courses.length > 0 && (
                  <div className="prereqs">
                    <strong>Prerequisites:</strong>
                    <ul>
                      {s.msar.prerequisite_courses.map((c) => {
                        const isRecommended = c.required_or_recommended === "Recommended";
                        const requirementStatus = isRecommended
                          ? "not-required"
                          : getSubjectRequirementStatus(s, profile, c.class_code);
                        let statusClass = "";
                        if (!isRecommended) {
                          if (requirementStatus === "unknown" || c.credit_hours == null) {
                            statusClass = " unknown";
                          } else if (hasFilters && requirementStatus === "met") {
                            statusClass = " met";
                          } else if (hasFilters && requirementStatus === "unmet") {
                            statusClass = " unmet";
                          }
                        }
                        const requirementLabel = isRecommended
                          ? "Recommended"
                          : hasFilters && requirementStatus === "met"
                            ? "Required · Met"
                            : hasFilters && requirementStatus === "unmet"
                              ? "Required · Not met"
                              : "Required";

                        return (
                          <li
                            key={`${c.class_code}-${c.course}-${c.required_or_recommended}`}
                            className={`${isRecommended ? "recommended" : "required"}${statusClass}`}
                          >
                            {c.course} ({c.class_code}) – {c.credit_hours != null
                              ? `${c.credit_hours}${c.credit_hours_inferred ? " estimated" : ""} hrs – `
                              : c.required_or_recommended === "Required" ? "Credit hours unknown – " : ""}
                            {requirementLabel}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
