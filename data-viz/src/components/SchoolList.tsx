import type { School, CandidateProfile } from "../types";
import { isEligible } from "../eligibility";

interface Props {
  regionName: string;
  schools: School[];
  profile: CandidateProfile;
  onClose: () => void;
}

export default function SchoolList({ regionName, schools, profile, onClose }: Props) {
  const hasFilters = profile.coursesTaken.size > 0;

  const eligible = hasFilters
    ? schools.filter((s) => isEligible(s, profile))
    : schools;

  return (
    <div className="school-list-panel">
      <div className="panel-header">
        <h2>{regionName}</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <p className="school-count">
        {eligible.length} of {schools.length} school{schools.length !== 1 ? "s" : ""}
        {hasFilters ? " match your profile" : ""}
      </p>
      {eligible.length === 0 && (
        <p className="no-results">No eligible schools found in this region.</p>
      )}
      <ul className="school-cards">
        {eligible.map((s, i) => (
          <li key={i} className="school-card">
            <h3>{s.school_name}</h3>
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
                  {s.msar.prerequisite_courses.map((c, j) => (
                    <li key={j} className={c.required_or_recommended === "Required" ? "required" : "recommended"}>
                      {c.course} ({c.class_code}) – {c.credit_hours} hrs – {c.required_or_recommended}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
