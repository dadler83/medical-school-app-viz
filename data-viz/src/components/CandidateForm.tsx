import { useState } from "react";
import type { CandidateProfile } from "../types";
import { COURSE_OPTIONS } from "../types";

interface Props {
  profile: CandidateProfile;
  onChange: (profile: CandidateProfile) => void;
}

export default function CandidateForm({ profile, onChange }: Props) {
  const [gpaInput, setGpaInput] = useState("");

  const handleSemesters = (code: string, value: string) => {
    const semesters = value === "" ? 0 : Number(value);
    onChange({
      ...profile,
      semestersBySubject: {
        ...profile.semestersBySubject,
        [code]: Number.isFinite(semesters) ? Math.max(0, semesters) : 0,
      },
    });
  };

  const handleGpa = (val: string) => {
    setGpaInput(val);
    const num = parseFloat(val);
    onChange({
      ...profile,
      gpa: isNaN(num) ? null : Math.min(4.0, Math.max(0, num)),
    });
  };

  return (
    <div className="candidate-form">
      <h2>Your Profile</h2>
      <div className="form-section">
        <label>Semesters completed by subject</label>
        <p className="form-help">Enter your completed semesters. Each semester is estimated as 4 credit hours.</p>
        <div className="semester-inputs">
          {COURSE_OPTIONS.map((c) => (
            <div key={c.code} className="semester-row">
              <label htmlFor={`semesters-${c.code}`}>{c.label}</label>
              <div className="semester-control">
                <input
                  id={`semesters-${c.code}`}
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={profile.semestersBySubject[c.code] || ""}
                  onChange={(e) => handleSemesters(c.code, e.target.value)}
                />
                <span>semesters</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="form-section">
        <label htmlFor="gpa-input">GPA (0.0 – 4.0)</label>
        <input
          id="gpa-input"
          type="number"
          min="0"
          max="4"
          step="0.01"
          placeholder="e.g. 3.5"
          value={gpaInput}
          onChange={(e) => handleGpa(e.target.value)}
        />
      </div>
    </div>
  );
}
