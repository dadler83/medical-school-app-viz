import { useState } from "react";
import type { CandidateProfile } from "../types";
import { COURSE_OPTIONS } from "../types";

interface Props {
  profile: CandidateProfile;
  onChange: (profile: CandidateProfile) => void;
}

export default function CandidateForm({ profile, onChange }: Props) {
  const [gpaInput, setGpaInput] = useState("");

  const toggleCourse = (code: string) => {
    const next = new Set(profile.coursesTaken);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange({ ...profile, coursesTaken: next });
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
        <label>Courses Completed</label>
        <div className="course-checkboxes">
          {COURSE_OPTIONS.map((c) => (
            <label key={c.code} className="checkbox-label">
              <input
                type="checkbox"
                checked={profile.coursesTaken.has(c.code)}
                onChange={() => toggleCourse(c.code)}
              />
              {c.label} ({c.code})
            </label>
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
