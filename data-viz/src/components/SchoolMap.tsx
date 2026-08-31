import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Layer, LeafletMouseEvent } from "leaflet";
import type { Feature, GeoJsonObject } from "geojson";
import type { School, SchoolData, CandidateProfile } from "../types";
import { getStateAbbr, isEligible, regionNameToAbbr } from "../eligibility";

interface Props {
  profile: CandidateProfile;
  onRegionClick: (regionName: string, schools: School[]) => void;
}

interface RegionSummary {
  total: number;
  eligible: number;
  schools: School[];
}

function getColor(eligible: number, total: number): string {
  if (total === 0) return "#f0f0f0";
  const ratio = eligible / total;
  if (ratio === 0) return "#fee5d9";
  if (ratio < 0.25) return "#fcae91";
  if (ratio < 0.5) return "#fb6a4a";
  if (ratio < 0.75) return "#de2d26";
  return "#a50f15";
}

export default function SchoolMap({ profile, onRegionClick }: Props) {
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [usGeo, setUsGeo] = useState<GeoJsonObject | null>(null);
  const [caGeo, setCaGeo] = useState<GeoJsonObject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}coalesced_school_data.json`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}us-states.json`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}canada_provinces.geo.json`).then((r) => r.json()),
    ]).then(([sd, us, ca]) => {
      setSchoolData(sd);
      setUsGeo(us);
      setCaGeo(ca);
    }).catch((err) => {
      setLoadError(`Failed to load map data: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, []);

  // Build region → summary lookup
  const regionMap = useMemo(() => {
    if (!schoolData) return new Map<string, RegionSummary>();
    const map = new Map<string, RegionSummary>();
    const hasFilters = profile.coursesTaken.size > 0;
    for (const school of Object.values(schoolData.schools)) {
      const abbr = getStateAbbr(school);
      if (!abbr) continue;
      const existing = map.get(abbr) || { total: 0, eligible: 0, schools: [] };
      existing.total++;
      existing.schools.push(school);
      if (!hasFilters || isEligible(school, profile)) {
        existing.eligible++;
      }
      map.set(abbr, existing);
    }
    return map;
  }, [schoolData, profile]);

  const styleFeature = (feature: Feature | undefined) => {
    if (!feature?.properties) return { fillColor: "#f0f0f0", weight: 1, color: "#666", fillOpacity: 0.6 };
    const name = feature.properties.name || "";
    const abbr = regionNameToAbbr(name);
    const summary = regionMap.get(abbr);
    const total = summary?.total ?? 0;
    const eligible = summary?.eligible ?? 0;
    return {
      fillColor: getColor(eligible, total),
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
    const eligible = summary?.eligible ?? 0;
    const hasFilters = profile.coursesTaken.size > 0;

    layer.bindTooltip(
      `<strong>${name}</strong><br/>Schools: ${total}${hasFilters ? `<br/>Eligible: ${eligible}` : ""}`,
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
        key={`us-${profile.coursesTaken.size}-${[...profile.coursesTaken].join(",")}`}
        data={usGeo}
        style={styleFeature}
        onEachFeature={onEachFeature}
      />
      <GeoJSON
        key={`ca-${profile.coursesTaken.size}-${[...profile.coursesTaken].join(",")}`}
        data={caGeo}
        style={styleFeature}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
