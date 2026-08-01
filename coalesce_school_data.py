import argparse
import difflib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple, Any


def normalize_name(name: str) -> str:
    """Normalize school names for cross-source matching."""
    lowered = name.lower().strip()

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


def token_set(text: str) -> set:
    normalized = normalize_name(text)
    return {t for t in re.split(r"\s+", normalized) if t}


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


def coalesce_school_data(
    deadlines_path: Path,
    msar_path: Path,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    deadline_records = load_deadlines(deadlines_path)
    msar_schools = load_msar(msar_path)

    deadline_index = build_deadline_index(deadline_records)
    used_deadline_names = set()

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
        }

    unmatched_deadline = [
        r["school_name"] for r in deadline_records if r["school_name"] not in used_deadline_names
    ]

    payload = {
        "metadata": {
            "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sources": {
                "deadlines": str(deadlines_path),
                "msar": str(msar_path),
            },
            "total_schools_in_output": len(merged_schools),
            "matched_schools": len(merged_schools) - len(unmatched_msar),
            "unmatched_msar_schools": len(unmatched_msar),
            "unmatched_deadline_schools": len(unmatched_deadline),
        },
        "schools": merged_schools,
    }

    report = {
        "unmatched_msar_schools": unmatched_msar,
        "unmatched_deadline_schools": unmatched_deadline,
    }

    return payload, report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Coalesce school deadlines data with MSAR requirements data.",
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
    return parser


def main() -> None:
    args = build_parser().parse_args()

    deadlines_path = Path(args.deadlines_json)
    msar_path = Path(args.msar_json)
    output_path = Path(args.output_json)
    report_path = Path(args.report_json)

    payload, report = coalesce_school_data(deadlines_path, msar_path)

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    with report_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Wrote merged dataset: {output_path}")
    print(f"Wrote coalesce report: {report_path}")
    print(f"Matched schools: {payload['metadata']['matched_schools']}")
    print(f"Unmatched MSAR schools: {payload['metadata']['unmatched_msar_schools']}")
    print(f"Unmatched deadline schools: {payload['metadata']['unmatched_deadline_schools']}")


if __name__ == "__main__":
    main()
