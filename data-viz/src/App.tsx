import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./App.css";
import CandidateForm from "./components/CandidateForm";
import SummaryPage from "./components/SummaryPage.tsx";
import SchoolMap from "./components/SchoolMap";
import SchoolList from "./components/SchoolList";
import type { CandidateProfile, School, SchoolData } from "./types";

type Page = "summary" | "map";

function App() {
  const [page, setPage] = useState<Page>("summary");
  const [profile, setProfile] = useState<CandidateProfile>({
    semestersBySubject: {},
    gpa: null,
  });
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  const [selectedRegion, setSelectedRegion] = useState<{
    name: string;
    schools: School[];
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    fetch(`${import.meta.env.BASE_URL}coalesced_school_data.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json() as Promise<SchoolData>;
      })
      .then((data) => {
        if (isCurrent) setSchoolData(data);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setDataLoadError(
            `Failed to load school data: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const schools = useMemo(
    () => (schoolData ? Object.values(schoolData.schools) : []),
    [schoolData]
  );

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Medical School Eligibility Explorer</h1>
        <nav className="page-nav" aria-label="Main navigation">
          <button
            type="button"
            className={page === "summary" ? "active" : ""}
            aria-current={page === "summary" ? "page" : undefined}
            onClick={() => setPage("summary")}
          >
            Summary
          </button>
          <button
            type="button"
            className={page === "map" ? "active" : ""}
            aria-current={page === "map" ? "page" : undefined}
            onClick={() => setPage("map")}
          >
            Map
          </button>
        </nav>
      </header>
      <aside className="sidebar">
        <CandidateForm profile={profile} onChange={setProfile} />
        {page === "map" && <div className="legend">
          <h3>Legend</h3>
          <p>After entering coursework, colors show eligible share among schools with known required hours</p>
          <div className="legend-items">
            <span><span className="swatch" style={{ background: "#f0f0f0" }} /> No schools</span>
            <span><span className="swatch" style={{ background: "#bdbdbd" }} /> No known requirements</span>
            <span><span className="swatch" style={{ background: "#fee5d9" }} /> 0%</span>
            <span><span className="swatch" style={{ background: "#fcae91" }} /> &lt;25%</span>
            <span><span className="swatch" style={{ background: "#fb6a4a" }} /> &lt;50%</span>
            <span><span className="swatch" style={{ background: "#de2d26" }} /> &lt;75%</span>
            <span><span className="swatch" style={{ background: "#a50f15" }} /> 75%+</span>
          </div>
        </div>}
      </aside>
      <main className={page === "map" ? "map-container" : "page-content"}>
        {page === "summary" ? (
          dataLoadError ? (
            <div className="map-loading">{dataLoadError}</div>
          ) : schoolData ? (
            <SummaryPage schools={schools} profile={profile} />
          ) : (
            <div className="map-loading">Loading school data…</div>
          )
        ) : dataLoadError ? (
          <div className="map-loading">{dataLoadError}</div>
        ) : schoolData ? (
          <>
            <SchoolMap
              schools={schools}
              profile={profile}
              onRegionClick={(name, regionSchools) =>
                setSelectedRegion({ name, schools: regionSchools })
              }
            />
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
          </>
        ) : (
          <div className="map-loading">Loading school data…</div>
        )}
      </main>
    </div>
  );
}

export default App;
