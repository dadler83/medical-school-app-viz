import { useState } from "react";
import "leaflet/dist/leaflet.css";
import "./App.css";
import CandidateForm from "./components/CandidateForm";
import SchoolMap from "./components/SchoolMap";
import SchoolList from "./components/SchoolList";
import type { CandidateProfile, School } from "./types";

function App() {
  const [profile, setProfile] = useState<CandidateProfile>({
    coursesTaken: new Set<string>(),
    gpa: null,
  });

  const [selectedRegion, setSelectedRegion] = useState<{
    name: string;
    schools: School[];
  } | null>(null);

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Medical School Eligibility Explorer</h1>
      </header>
      <aside className="sidebar">
        <CandidateForm profile={profile} onChange={setProfile} />
        <div className="legend">
          <h3>Legend</h3>
          <p>States colored by proportion of eligible schools</p>
          <div className="legend-items">
            <span><span className="swatch" style={{ background: "#f0f0f0" }} /> No schools</span>
            <span><span className="swatch" style={{ background: "#fee5d9" }} /> 0%</span>
            <span><span className="swatch" style={{ background: "#fcae91" }} /> &lt;25%</span>
            <span><span className="swatch" style={{ background: "#fb6a4a" }} /> &lt;50%</span>
            <span><span className="swatch" style={{ background: "#de2d26" }} /> &lt;75%</span>
            <span><span className="swatch" style={{ background: "#a50f15" }} /> 75%+</span>
          </div>
        </div>
      </aside>
      <main className="map-container">
        <SchoolMap
          profile={profile}
          onRegionClick={(name, schools) =>
            setSelectedRegion({ name, schools })
          }
        />
      </main>
      {selectedRegion && (
        <aside className="school-panel">
          <SchoolList
            regionName={selectedRegion.name}
            schools={selectedRegion.schools}
            profile={profile}
            onClose={() => setSelectedRegion(null)}
          />
        </aside>
      )}
    </div>
  );
}

export default App;
