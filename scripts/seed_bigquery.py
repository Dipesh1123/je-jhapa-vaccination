"""Load ref_local_level and ref_ward into BigQuery from data/reference.json.

Idempotent: truncates and reloads both tables, so re-running after a microplan
correction is always safe. Requires `gcloud auth application-default login` or
GOOGLE_APPLICATION_CREDENTIALS pointing at the je-portal-api service-account key.

Run:  python scripts/seed_bigquery.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from google.cloud import bigquery

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / "data" / "reference.json"
PROJECT = "je-jhapa-vaccination"
DATASET = "je_jhapa"


def main() -> int:
    if not REFERENCE.exists():
        sys.exit("data/reference.json missing - run scripts/extract_reference.py first")

    ref = json.loads(REFERENCE.read_text(encoding="utf-8"))
    client = bigquery.Client(project=PROJECT)

    local_level_rows = [
        {
            "code": ll["code"],
            "name": ll["name"],
            "population": ll["population"],
            "je_target": ll["je_target"],
            "ward_count": ll["ward_count"],
        }
        for ll in ref["local_levels"]
    ]

    ward_rows = [
        {
            "code": w["code"],
            "local_level_code": ll["code"],
            "ward_no": w["ward_no"],
            "population": w["population"],
            "je_target": w["je_target"],
        }
        for ll in ref["local_levels"]
        for w in ll["wards"]
    ]

    for table_name, rows in [
        ("ref_local_level", local_level_rows),
        ("ref_ward", ward_rows),
    ]:
        table_id = f"{PROJECT}.{DATASET}.{table_name}"
        client.query(f"TRUNCATE TABLE `{table_id}`").result()
        errors = client.insert_rows_json(table_id, rows)
        if errors:
            print(f"FAILED inserting into {table_name}:", file=sys.stderr)
            for e in errors:
                print(f"  {e}", file=sys.stderr)
            return 1
        print(f"loaded {len(rows)} rows into {table_name}")

    # Verify against the workbook's own totals - the same numbers extract_reference.py printed.
    check = client.query(f"""
        SELECT
          (SELECT COUNT(*) FROM `{PROJECT}.{DATASET}.ref_local_level`) AS local_levels,
          (SELECT COUNT(*) FROM `{PROJECT}.{DATASET}.ref_ward`)        AS wards,
          (SELECT SUM(population) FROM `{PROJECT}.{DATASET}.ref_ward`) AS population,
          (SELECT ROUND(SUM(je_target)) FROM `{PROJECT}.{DATASET}.ref_ward`) AS je_target
    """).result()
    row = list(check)[0]

    print(f"  local levels : {row.local_levels} (expect 15)")
    print(f"  wards        : {row.wards} (expect 131)")
    print(f"  population   : {row.population:,} (expect 1,027,747)")
    print(f"  JE target    : {row.je_target:,} (expect 493,319)")

    ok = (row.local_levels == 15 and row.wards == 131
          and row.population == 1_027_747 and row.je_target == 493_319)
    if not ok:
        print("MISMATCH against the workbook - do not proceed until this reconciles.",
              file=sys.stderr)
        return 1

    print("reconciled against JE-083_84.xlsx")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
