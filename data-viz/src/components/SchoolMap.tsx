import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Layer, LeafletMouseEvent } from "leaflet";
import type { Feature, GeoJsonObject } from "geojson";
import type { School, CandidateProfile } from "../types";
import { getEligibilityStatus, getStateAbbr, hasCoursework, regionNameToAbbr } from "../eligibility";

interface Props {
  schools: School[];
  profile: CandidateProfile;
  onRegionClick: (regionName: string, schools: School[]) => void;
}

interface RegionSummary {
  total: number;
  rated: number;
  eligible: number;
  unknown: number;
  schools: School[];
}

function getColor(eligible: number, rated: number, total: number): string {
  if (total === 0) return "#f0f0f0";
  if (rated === 0) return "#bdbdbd";
  const ratio = eligible / rated;
  if (ratio === 0) return "#fee5d9";
  if (ratio < 0.25) return "#fcae91";
  if (ratio < 0.5) return "#fb6a4a";
  if (ratio < 0.75) return "#de2d26";
  return "#a50f15";
}

export default function SchoolMap({ schools, profile, onRegionClick }: Props) {
  const [usGeo, setUsGeo] = useState<GeoJsonObject | null>(null);
  const [caGeo, setCaGeo] = useState<GeoJsonObject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}us-states.json`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}canada_provinces.geo.json`).then((r) => r.json()),
    ]).then(([us, ca]) => {
      setUsGeo(us);
      setCaGeo(ca);
    }).catch((err) => {
      setLoadError(`Failed to load map data: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, []);

  // Build region → summary lookup
  const regionMap = useMemo(() => {
    const map = new Map<string, RegionSummary>();
    const hasFilters = hasCoursework(profile);
    for (const school of schools) {
      const abbr = getStateAbbr(school);
      if (!abbr) continue;
      const existing = map.get(abbr) || { total: 0, rated: 0, eligible: 0, unknown: 0, schools: [] };
      existing.total++;
      existing.schools.push(school);
      if (!hasFilters) {
        existing.rated++;
        existing.eligible++;
      } else {
        const status = getEligibilityStatus(school, profile);
        if (status === "unknown") {
          existing.unknown++;
        } else {
          existing.rated++;
          if (status === "eligible") existing.eligible++;
        }
      }
      map.set(abbr, existing);
    }
    return map;
  }, [schools, profile]);

  const styleFeature = (feature: Feature | undefined) => {
    if (!feature?.properties) return { fillColor: "#f0f0f0", weight: 1, color: "#666", fillOpacity: 0.6 };
    const name = feature.properties.name || "";
    const abbr = regionNameToAbbr(name);
    const summary = regionMap.get(abbr);
    const total = summary?.total ?? 0;
    const rated = summary?.rated ?? 0;
    const eligible = summary?.eligible ?? 0;
    return {
      fillColor: getColor(eligible, rated, total),
      weight: 1,
      color: "#666",
      fillOpacity: 0.7,
    };
  };

  const onEachFeature = (feature: Feature, layer: Layer) => {
    const name = feature.properties?.name || "";
    const abbr = regionNameToAbbr(name);
    const summary = regionMap.get(abbr);
    const total = summary?.total ?? 0;
    const rated = summary?.rated ?? 0;
    const eligible = summary?.eligible ?? 0;
    const unknown = summary?.unknown ?? 0;
    const hasFilters = hasCoursework(profile);

    layer.bindTooltip(
      `<strong>${name}</strong><br/>Schools: ${total}${hasFilters ? `<br/>Eligible (known requirements): ${eligible}/${rated}<br/>Unknown requirements: ${unknown}` : ""}`,
      { sticky: true }
    );

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        e.target.setStyle({ weight: 3, color: "#333", fillOpacity: 0.85 });
      },
      mouseout: (e: LeafletMouseEvent) => {
        e.target.setStyle({ weight: 1, color: "#666", fillOpacity: 0.7 });
      },
      click: () => {
        if (summary && summary.schools.length > 0) {
          onRegionClick(name, summary.schools);
        }
      },
    });
  };

  if (loadError) {
    return <div className="map-loading">{loadError}</div>;
  }

  if (!usGeo || !caGeo) {
    return <div className="map-loading">Loading map…</div>;
  }

  return (
    <MapContainer
      center={[45, -95]}
      zoom={4}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        key={`us-${JSON.stringify(profile.semestersBySubject)}`}
        data={usGeo}
        style={styleFeature}
        onEachFeature={onEachFeature}
      />
      <GeoJSON
        key={`ca-${JSON.stringify(profile.semestersBySubject)}`}
        data={caGeo}
        style={styleFeature}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
