import argparse
import difflib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple, Any

from facts_csv_to_json import parse_table


def normalize_name(name: str) -> str:
    """Normalize school names for cross-source matching."""
    lowered = name.lower().strip()

    # Expand common abbreviations used in FACTS CSV school labels.
    abbreviation_replacements = [
        (r"\bucf\b", "university central florida"),
        (r"\bucla\b", "university california los angeles"),
        (r"\buc\s+", "university california "),
        (r"\but\s+", "university texas "),
        (r"\buthealth\s+houston\b", "university texas health houston"),
        (r"\blsu\s+", "louisiana state university "),
        (r"\bbu[-\s]+", "boston university "),
        (r"\bsouthern\s+cal\b", "southern california"),
        (r"\bcuny\b", "city university new york"),
        (r"\bsuny\b", "state university new york"),
        (r"\bmc\s+wisconsin\b", "medical college wisconsin"),
        (r"\bfiu\b", "florida international university"),
        (r"\bmu\s+south\s+carolina\b", "medical university south carolina"),
        (r"\bpenn\s+state\b", "pennsylvania state"),
    ]
    for pattern, replacement in abbreviation_replacements:
        lowered = re.sub(pattern, replacement, lowered)

    # Drop common parser-tail fragments that are not part of school names.
    tail_markers = [
        " refer to",
        " pre-requisite",
        " permitted",
        " advanced placement",
        " ap chemistry",
        " for basic",
        " kpsom will",
        " see faq",
        " the school",
        " jssom will",
        " the record",
    ]
    for marker in tail_markers:
        marker_idx = lowered.find(marker)
        if marker_idx > 0:
            lowered = lowered[:marker_idx].strip()
            break

    # Drop punctuation and unify separators.
    cleaned = re.sub(r"[&,+./()-]", " ", lowered)

    # Remove common high-noise terms and articles that differ across sources.
    stopwords = {
        "the",
        "at",
        "of",
        "for",
        "and",
        "school",
        "college",
        "medicine",
        "medical",
        "sciences",
        "division",
        "faculty",
        "campus",
    }
    tokens = [t for t in re.split(r"\s+", cleaned) if t]
    filtered = [t for t in tokens if t not in stopwords]

    # Return sorted unique tokens for stable matching when word order changes.
    dedup_sorted = sorted(set(filtered))
    return " ".join(dedup_sorted)


def load_deadlines(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    records: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict) or len(item) != 1:
            continue
        school_name = next(iter(item.keys()))
        details = item[school_name]
        if not isinstance(details, dict):
            continue

        records.append(
            {
                "school_name": school_name,
                "state": details.get("state"),
                "application_deadline": details.get("application_deadline"),
                "criminal_background_check": details.get("criminal_background_check"),
            }
        )

    return records


def load_msar(path: Path) -> Dict[str, Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    return raw.get("schools", {})


def build_deadline_index(deadline_records: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    index: Dict[str, List[Dict[str, Any]]] = {}
    for record in deadline_records:
        key = normalize_name(record["school_name"])
        index.setdefault(key, []).append(record)
    return index


def build_name_index(records: List[Dict[str, Any]], name_field: str) -> Dict[str, List[Dict[str, Any]]]:
    index: Dict[str, List[Dict[str, Any]]] = {}
    for record in records:
        key = normalize_name(record.get(name_field, ""))
        index.setdefault(key, []).append(record)
    return index


def token_set(text: str) -> set:
    normalized = normalize_name(text)
    return {t for t in re.split(r"\s+", normalized) if t}


def acronym_from_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9 ]+", " ", name).strip()
    parts = [p for p in cleaned.split() if p]
    if not parts:
        return ""
    return "".join(p[0].upper() for p in parts)


def fuzzy_match_deadline_record(
    msar_school_name: str,
    deadline_records: List[Dict[str, Any]],
) -> Dict[str, Any] | None:
    """Find a likely deadline match for noisy/truncated MSAR school names."""
    msar_norm = normalize_name(msar_school_name)
    msar_tokens = token_set(msar_school_name)
    if len(msar_tokens) < 2:
        return None

    best_record = None
    best_score = 0.0
    second_best = 0.0

    for candidate in deadline_records:
        candidate_name = candidate["school_name"]
        candidate_norm = normalize_name(candidate_name)
        candidate_tokens = token_set(candidate_name)
        if not candidate_tokens:
            continue

        overlap = len(msar_tokens & candidate_tokens)
        if overlap < 2:
            continue

        token_score = overlap / min(len(msar_tokens), len(candidate_tokens))
        seq_score = difflib.SequenceMatcher(a=msar_norm, b=candidate_norm).ratio()
        score = (0.7 * token_score) + (0.3 * seq_score)

        if score > best_score:
            second_best = best_score
            best_score = score
            best_record = candidate
        elif score > second_best:
            second_best = score

    # Require a strong score and a margin to avoid ambiguous generic matches.
    if best_record and best_score >= 0.68 and (best_score - second_best) >= 0.05:
        return best_record

    return None


def choose_best_deadline_match(
    msar_school_name: str,
    candidates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Pick the best candidate by token overlap if normalization creates collisions."""
    msar_tokens = set(re.split(r"\s+", normalize_name(msar_school_name)))

    best = candidates[0]
    best_score = -1
    for candidate in candidates:
        candidate_tokens = set(re.split(r"\s+", normalize_name(candidate["school_name"])))
        score = len(msar_tokens & candidate_tokens)
        if score > best_score:
            best = candidate
            best_score = score
    return best


def choose_best_name_match(
    source_name: str,
    candidates: List[Dict[str, Any]],
    candidate_name_field: str,
) -> Dict[str, Any]:
    """Pick the best candidate by token overlap if normalization creates collisions."""
    source_tokens = set(re.split(r"\s+", normalize_name(source_name)))

    best = candidates[0]
    best_score = -1
    for candidate in candidates:
        candidate_name = candidate.get(candidate_name_field, "")
        candidate_tokens = set(re.split(r"\s+", normalize_name(candidate_name)))
        score = len(source_tokens & candidate_tokens)
        if score > best_score:
            best = candidate
            best_score = score
    return best


def fuzzy_match_record(
    source_name: str,
    candidate_records: List[Dict[str, Any]],
    candidate_name_field: str,
    used_names: set[str],
    min_overlap: int = 2,
    preferred_state: str | None = None,
    candidate_state_field: str = "state",
) -> Dict[str, Any] | None:
    """Find a likely match for shortened source names."""
    source_norm = normalize_name(source_name)
    source_tokens = token_set(source_name)
    source_acronym = acronym_from_name(source_name)
    if len(source_tokens) < min_overlap:
        return None

    best_record = None
    best_score = 0.0
    second_best = 0.0

    for candidate in candidate_records:
        candidate_name = candidate.get(candidate_name_field, "")
        if candidate_name in used_names:
            continue

        candidate_norm = normalize_name(candidate_name)
        candidate_tokens = token_set(candidate_name)
        candidate_acronym = acronym_from_name(candidate_name)
        if not candidate_tokens:
            continue

        overlap = len(source_tokens & candidate_tokens)
        if overlap < min_overlap:
            continue

        token_score = overlap / min(len(source_tokens), len(candidate_tokens))
        seq_score = difflib.SequenceMatcher(a=source_norm, b=candidate_norm).ratio()
        state_score = 0.0
        candidate_state = candidate.get(candidate_state_field)
        if preferred_state and candidate_state == preferred_state:
            state_score = 1.0

        acronym_score = 0.0
        if source_acronym and candidate_acronym and source_acronym == candidate_acronym:
            acronym_score = 1.0
        elif source_norm.upper() == candidate_acronym:
            acronym_score = 1.0

        score = (0.6 * token_score) + (0.25 * seq_score) + (0.1 * state_score) + (0.05 * acronym_score)

        if score > best_score:
            second_best = best_score
            best_score = score
            best_record = candidate
        elif score > second_best:
            second_best = score

    # Require a strong score and a margin to avoid ambiguous generic matches.
    threshold = 0.68 if min_overlap >= 2 else 0.58
    margin = 0.05 if min_overlap >= 2 else 0.03
    if best_record and best_score >= threshold and (best_score - second_best) >= margin:
        return best_record

    return None


def load_facts_records(csv_path: Path) -> List[Dict[str, Any]]:
    table = parse_table(csv_path)
    return table.get("rows", [])


def extract_stats_payload(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "source_school_name": record.get("medical_school"),
        "state": record.get("state"),
        "applications_total": record.get("applications_total"),
        "applications_in_state_pct": record.get("applications_in_state_pct"),
        "applications_out_of_state_pct": record.get("applications_out_of_state_pct"),
        "applications_men_pct": record.get("applications_men_pct"),
        "applications_women_pct": record.get("applications_women_pct"),
        "matriculants_total": record.get("matriculants_total"),
        "matriculants_in_state_pct": record.get("matriculants_in_state_pct"),
        "matriculants_out_of_state_pct": record.get("matriculants_out_of_state_pct"),
        "matriculants_men_pct": record.get("matriculants_men_pct"),
        "matriculants_women_pct": record.get("matriculants_women_pct"),
    }


def coalesce_school_data(
    deadlines_path: Path,
    msar_path: Path,
    md_stats_csv_path: Path,
    md_phd_stats_csv_path: Path,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    deadline_records = load_deadlines(deadlines_path)
    msar_schools = load_msar(msar_path)
    md_stats_records = load_facts_records(md_stats_csv_path)
    md_phd_stats_records = load_facts_records(md_phd_stats_csv_path)

    deadline_index = build_deadline_index(deadline_records)
    md_stats_index = build_name_index(md_stats_records, "medical_school")
    md_phd_stats_index = build_name_index(md_phd_stats_records, "medical_school")

    used_deadline_names = set()
    used_md_stats_names = set()
    used_md_phd_stats_names = set()

    merged_schools: Dict[str, Any] = {}
    unmatched_msar = []

    for msar_slug, msar_school in msar_schools.items():
        msar_name = msar_school.get("school_name", "")
        normalized = normalize_name(msar_name)
        candidates = deadline_index.get(normalized, [])

        deadline_data = None
        if candidates:
            deadline_data = choose_best_deadline_match(msar_name, candidates)
            used_deadline_names.add(deadline_data["school_name"])
        else:
            fuzzy_candidate = fuzzy_match_deadline_record(msar_name, deadline_records)
            if fuzzy_candidate:
                deadline_data = fuzzy_candidate
                used_deadline_names.add(deadline_data["school_name"])
            else:
                unmatched_msar.append(msar_name)

        md_stats_data = None
        md_candidates = [
            c for c in md_stats_index.get(normalized, []) if c.get("medical_school") not in used_md_stats_names
        ]
        if md_candidates:
            md_stats_data = choose_best_name_match(msar_name, md_candidates, "medical_school")
            used_md_stats_names.add(md_stats_data.get("medical_school", ""))
        else:
            md_candidates_by_state = [
                c
                for c in md_stats_records
                if c.get("medical_school") not in used_md_stats_names
                and c.get("state") == msar_school.get("state")
            ]
            md_fuzzy_candidate = fuzzy_match_record(
                msar_name,
                md_candidates_by_state,
                "medical_school",
                used_md_stats_names,
                min_overlap=1,
                preferred_state=msar_school.get("state"),
            )
            if not md_fuzzy_candidate:
                md_fuzzy_candidate = fuzzy_match_record(
                    msar_name,
                    md_stats_records,
                    "medical_school",
                    used_md_stats_names,
                    min_overlap=1,
                    preferred_state=msar_school.get("state"),
                )
            if md_fuzzy_candidate:
                md_stats_data = md_fuzzy_candidate
                used_md_stats_names.add(md_stats_data.get("medical_school", ""))

        md_phd_stats_data = None
        md_phd_candidates = [
            c
            for c in md_phd_stats_index.get(normalized, [])
            if c.get("medical_school") not in used_md_phd_stats_names
        ]
        if md_phd_candidates:
            md_phd_stats_data = choose_best_name_match(msar_name, md_phd_candidates, "medical_school")
            used_md_phd_stats_names.add(md_phd_stats_data.get("medical_school", ""))
        else:
            md_phd_candidates_by_state = [
                c
                for c in md_phd_stats_records
                if c.get("medical_school") not in used_md_phd_stats_names
                and c.get("state") == msar_school.get("state")
            ]
            md_phd_fuzzy_candidate = fuzzy_match_record(
                msar_name,
                md_phd_candidates_by_state,
                "medical_school",
                used_md_phd_stats_names,
                min_overlap=1,
                preferred_state=msar_school.get("state"),
            )
            if not md_phd_fuzzy_candidate:
                md_phd_fuzzy_candidate = fuzzy_match_record(
                    msar_name,
                    md_phd_stats_records,
                    "medical_school",
                    used_md_phd_stats_names,
                    min_overlap=1,
                    preferred_state=msar_school.get("state"),
                )
            if md_phd_fuzzy_candidate:
                md_phd_stats_data = md_phd_fuzzy_candidate
                used_md_phd_stats_names.add(md_phd_stats_data.get("medical_school", ""))

        merged_schools[msar_slug] = {
            "school_name": msar_name,
            "state": {
                "msar": msar_school.get("state"),
                "deadlines": deadline_data.get("state") if deadline_data else None,
            },
            "application": {
                "application_deadline": deadline_data.get("application_deadline") if deadline_data else None,
                "criminal_background_check": deadline_data.get("criminal_background_check") if deadline_data else None,
            },
            "msar": {
                "source_pages": msar_school.get("source_pages", []),
                "prerequisite_courses": msar_school.get("prerequisite_courses", []),
                "page_notes": msar_school.get("page_notes", []),
            },
            "statistics": {
                "md": extract_stats_payload(md_stats_data) if md_stats_data else None,
                "md_phd": extract_stats_payload(md_phd_stats_data) if md_phd_stats_data else None,
            },
        }

    unmatched_deadline = [
        r["school_name"] for r in deadline_records if r["school_name"] not in used_deadline_names
    ]
    unmatched_md_stats = [
        r["medical_school"] for r in md_stats_records if r["medical_school"] not in used_md_stats_names
    ]
    unmatched_md_phd_stats = [
        r["medical_school"] for r in md_phd_stats_records if r["medical_school"] not in used_md_phd_stats_names
    ]

    payload = {
        "metadata": {
            "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sources": {
                "deadlines": str(deadlines_path),
                "msar": str(msar_path),
                "md_stats_csv": str(md_stats_csv_path),
                "md_phd_stats_csv": str(md_phd_stats_csv_path),
            },
            "total_schools_in_output": len(merged_schools),
            "matched_schools": len(merged_schools) - len(unmatched_msar),
            "unmatched_msar_schools": len(unmatched_msar),
            "unmatched_deadline_schools": len(unmatched_deadline),
            "matched_md_stats_schools": len(used_md_stats_names),
            "matched_md_phd_stats_schools": len(used_md_phd_stats_names),
            "unmatched_md_stats_schools": len(unmatched_md_stats),
            "unmatched_md_phd_stats_schools": len(unmatched_md_phd_stats),
        },
        "schools": merged_schools,
    }

    report = {
        "unmatched_msar_schools": unmatched_msar,
        "unmatched_deadline_schools": unmatched_deadline,
        "unmatched_md_stats_schools": unmatched_md_stats,
        "unmatched_md_phd_stats_schools": unmatched_md_phd_stats,
    }

    return payload, report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Coalesce school deadlines, MSAR requirements, and FACTS MD/MD-PhD statistics.",
    )
    parser.add_argument(
        "--deadlines-json",
        default="app_deadlines_by_school.json",
        help="Path to deadlines JSON file.",
    )
    parser.add_argument(
        "--msar-json",
        default="msar_requirements_by_school.json",
        help="Path to MSAR requirements JSON file.",
    )
    parser.add_argument(
        "--output-json",
        default="coalesced_school_data.json",
        help="Path for merged output JSON file.",
    )
    parser.add_argument(
        "--report-json",
        default="coalesce_report.json",
        help="Path for unmatched schools report JSON file.",
    )
    parser.add_argument(
        "--md-stats-csv",
        default="2025_FACTS_Table_matriculants.csv",
        help="Path to MD applications/matriculants FACTS CSV.",
    )
    parser.add_argument(
        "--md-phd-stats-csv",
        default="2025_FACTS_Table_md_phd.csv",
        help="Path to MD-PhD applications/matriculants FACTS CSV.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    deadlines_path = Path(args.deadlines_json)
    msar_path = Path(args.msar_json)
    md_stats_csv_path = Path(args.md_stats_csv)
    md_phd_stats_csv_path = Path(args.md_phd_stats_csv)
    output_path = Path(args.output_json)
    report_path = Path(args.report_json)

    payload, report = coalesce_school_data(
        deadlines_path,
        msar_path,
        md_stats_csv_path,
        md_phd_stats_csv_path,
    )

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    with report_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Wrote merged dataset: {output_path}")
    print(f"Wrote coalesce report: {report_path}")
    print(f"Matched schools: {payload['metadata']['matched_schools']}")
    print(f"Unmatched MSAR schools: {payload['metadata']['unmatched_msar_schools']}")
    print(f"Unmatched deadline schools: {payload['metadata']['unmatched_deadline_schools']}")
    print(f"Matched MD stats schools: {payload['metadata']['matched_md_stats_schools']}")
    print(f"Matched MD-PhD stats schools: {payload['metadata']['matched_md_phd_stats_schools']}")
    print(f"Unmatched MD stats schools: {payload['metadata']['unmatched_md_stats_schools']}")
    print(f"Unmatched MD-PhD stats schools: {payload['metadata']['unmatched_md_phd_stats_schools']}")


if __name__ == "__main__":
    main()
