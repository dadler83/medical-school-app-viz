"""Parse AAMC FACTS CSV tables into JSON.

The source CSVs use multi-row headers with merged cells represented as blanks.
This script flattens those headers into stable field names and forward-fills the
state column so repeated rows stay attached to the correct state.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def clean_cell(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def parse_number(value: str) -> int | float | str:
    if not value:
        return ""

    compact = value.replace(",", "")
    if re.fullmatch(r"-?\d+", compact):
        return int(compact)
    if re.fullmatch(r"-?\d+\.\d+", compact):
        return float(compact)
    return value


def read_csv_rows(path: Path) -> List[List[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [[clean_cell(cell) for cell in row] for row in csv.reader(handle)]


def find_data_header_row(rows: List[List[str]]) -> int:
    for index, row in enumerate(rows):
        if len(row) >= 2 and row[0] == "State" and row[1] == "Medical School":
            return index
    raise ValueError("Could not find the data header row with State / Medical School.")


def find_detail_row_index(rows: List[List[str]], header_row_index: int) -> int:
    for index in range(header_row_index - 1, -1, -1):
        row = rows[index]
        if any(cell and cell != "%" for cell in row[2:]):
            return index
    raise ValueError("Could not find the detail header row above the data header.")


def build_columns(rows: List[List[str]], header_row_index: int) -> List[Dict[str, Any]]:
    header_row = rows[header_row_index]
    leaf_row = rows[find_detail_row_index(rows, header_row_index)]

    columns: List[Dict[str, Any]] = []
    for index in range(len(header_row)):
        if index == 0:
            columns.append(
                {
                    "index": index,
                    "field_name": "state",
                    "header_path": ["State"],
                    "kind": "dimension",
                }
            )
            continue

        if index == 1:
            columns.append(
                {
                    "index": index,
                    "field_name": "medical_school",
                    "header_path": ["Medical School"],
                    "kind": "dimension",
                }
            )
            continue

        if 2 <= index <= 6:
            if index == 2:
                columns.append(
                    {
                        "index": index,
                        "field_name": "applications_total",
                        "header_path": ["Applications", "Total"],
                        "kind": "count",
                    }
                )
            else:
                label = slugify(leaf_row[index])
                if not label:
                    label = f"col_{index}"
                columns.append(
                    {
                        "index": index,
                        "field_name": f"applications_{label}_pct",
                        "header_path": ["Applications", leaf_row[index], "Percent"],
                        "kind": "percentage",
                    }
                )
            continue

        if 7 <= index <= 11:
            if index == 7:
                columns.append(
                    {
                        "index": index,
                        "field_name": "matriculants_total",
                        "header_path": ["Matriculants", "Total"],
                        "kind": "count",
                    }
                )
            else:
                label = slugify(leaf_row[index])
                if not label:
                    label = f"col_{index}"
                columns.append(
                    {
                        "index": index,
                        "field_name": f"matriculants_{label}_pct",
                        "header_path": ["Matriculants", leaf_row[index], "Percent"],
                        "kind": "percentage",
                    }
                )

    return columns


def parse_table(path: Path) -> Dict[str, Any]:
    rows = read_csv_rows(path)
    header_row_index = find_data_header_row(rows)
    columns = build_columns(rows, header_row_index)

    records: List[Dict[str, Any]] = []
    current_state = ""

    for row in rows[header_row_index + 1 :]:
        if not any(row):
            continue

        record: Dict[str, Any] = {}
        for column in columns:
            index = column["index"]
            value = row[index] if index < len(row) else ""

            if column["field_name"] == "state":
                if value:
                    current_state = value
                    record["state"] = value
                else:
                    record["state"] = current_state
                continue

            if value == "":
                record[column["field_name"]] = ""
            else:
                record[column["field_name"]] = parse_number(value)

        if record.get("medical_school"):
            records.append(record)

    title = rows[0][0] if rows and rows[0] and rows[0][0] else path.name
    description = rows[2][0] if len(rows) > 2 and rows[2] and rows[2][0] else ""

    return {
        "source_file": str(path),
        "title": title,
        "description": description,
        "header_row_index": header_row_index,
        "columns": columns,
        "rows": records,
    }


def build_payload(input_paths: List[Path]) -> Dict[str, Any]:
    tables = [parse_table(path) for path in input_paths]
    return {
        "metadata": {
            "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_files": [str(path) for path in input_paths],
            "table_count": len(tables),
        },
        "tables": tables,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Parse FACTS CSV tables into JSON.")
    parser.add_argument(
        "input_csv",
        nargs="+",
        help="One or more FACTS CSV files to parse.",
    )
    parser.add_argument(
        "--output-json",
        default="facts_tables.json",
        help="Destination JSON path.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    input_paths = [Path(path) for path in args.input_csv]
    payload = build_payload(input_paths)

    output_path = Path(args.output_json)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    print(f"Wrote {payload['metadata']['table_count']} table(s) to {output_path}")


if __name__ == "__main__":
    main()