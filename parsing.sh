#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${ROOT_DIR}/data"
PYTHON="${PYTHON:-python3}"

MSAR_PDF="${1:-${DATA_DIR}/MSAR002 - MSAR Premed Course Requirements.pdf}"
DEADLINES_JSON="${DATA_DIR}/app_deadlines_by_school.json"
FACTS_MD_CSV="${DATA_DIR}/2025_FACTS_Table_matriculants.csv"
FACTS_MD_PHD_CSV="${DATA_DIR}/2025_FACTS_Table_md_phd.csv"

FACTS_JSON="${DATA_DIR}/facts_tables.json"
MSAR_JSON="${DATA_DIR}/msar_requirements_by_school.json"
NORMALIZED_PDF="${DATA_DIR}/output.pdf"
COALESCED_JSON="${DATA_DIR}/coalesced_school_data.json"
COALESCE_REPORT="${DATA_DIR}/coalesce_report.json"

for file in "$MSAR_PDF" "$DEADLINES_JSON" "$FACTS_MD_CSV" "$FACTS_MD_PHD_CSV"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required input: $file" >&2
    exit 1
  fi
done

"$PYTHON" "$ROOT_DIR/facts_csv_to_json.py" \
  "$FACTS_MD_CSV" \
  "$FACTS_MD_PHD_CSV" \
  --output-json "$FACTS_JSON" > /dev/null

"$PYTHON" "$ROOT_DIR/admission_parsing.py" \
  --input-pdf "$MSAR_PDF" \
  --normalized-pdf "$NORMALIZED_PDF" \
  --output-json "$MSAR_JSON" > /dev/null

"$PYTHON" "$ROOT_DIR/coalesce_school_data.py" \
  --deadlines-json "$DEADLINES_JSON" \
  --msar-json "$MSAR_JSON" \
  --md-stats-csv "$FACTS_MD_CSV" \
  --md-phd-stats-csv "$FACTS_MD_PHD_CSV" \
  --output-json "$COALESCED_JSON" \
  --report-json "$COALESCE_REPORT"

echo "Wrote outputs to $DATA_DIR"