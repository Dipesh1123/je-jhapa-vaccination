"""Filter Jhapa's 15 local levels out of Open Knowledge Nepal's Koshi-province
boundary file and re-key them to our ref_local_level.code values.

Source: openknowledgenp/localboundaries (MIT licensed), gh-pages branch,
public/data/local-level/koshi.geojson. Jhapa sits in Koshi (Province 1).

The source spells three names differently from JE-083_84.xlsx's transliteration
(Gauradhaha/Gauradaha, Kachankawal/Kachanakawal, Shivasataxi/Shivasatakshi) -
mapped explicitly below rather than fuzzy-matched, since a silent mismatch in
a health dashboard is worse than a script that fails loudly on a miss.

Run:  python scripts/build_palika_geojson.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / "data" / "reference.json"
OUT_GEOJSON = ROOT / "public" / "data" / "jhapa-palikas.geojson"
SOURCE_URL = (
    "https://raw.githubusercontent.com/openknowledgenp/localboundaries/"
    "gh-pages/public/data/local-level/koshi.geojson"
)

# GeoJSON "GaPa_NaPa" -> our ref_local_level.code (from scripts/extract_reference.py)
NAME_TO_CODE = {
    "Arjundhara": "arjundhara_municipality",
    "Barhadashi": "barhadashi_gaunpalika",
    "Bhadrapur": "bhadrapur_municipality",
    "Birtamod": "birtamod_municipality",
    "Buddhashanti": "buddhashanti_gaunpalika",
    "Damak": "damak_municipality",
    "Gauradhaha": "gauradaha_municipality",       # source spelling differs
    "Gauriganj": "gauriganj_gaunpalika",
    "Haldibari": "haldibari_gaunpalika",
    "Jhapa": "jhapa_gaunpalika",
    "Kachankawal": "kachanakawal_gaunpalika",      # source spelling differs
    "Kamal": "kamal_gaunpalika",
    "Kankai": "kankai_municipality",
    "Mechinagar": "mechinagar_municipality",
    "Shivasataxi": "shivasatakshi_municipality",   # source spelling differs
}


def main() -> int:
    reference = json.loads(REFERENCE.read_text(encoding="utf-8"))
    expected_codes = {ll["code"] for ll in reference["local_levels"]}
    code_to_name = {ll["code"]: ll["name"] for ll in reference["local_levels"]}

    print(f"fetching {SOURCE_URL}")
    with urllib.request.urlopen(SOURCE_URL, timeout=30) as resp:
        source = json.loads(resp.read())

    jhapa_features = [f for f in source["features"] if f["properties"].get("DISTRICT") == "JHAPA"]
    print(f"found {len(jhapa_features)} Jhapa features in the source")

    out_features = []
    matched_codes = set()
    unmapped = []

    for feat in jhapa_features:
        source_name = feat["properties"].get("GaPa_NaPa")
        code = NAME_TO_CODE.get(source_name)
        if code is None:
            unmapped.append(source_name)
            continue
        matched_codes.add(code)
        out_features.append({
            "type": "Feature",
            "geometry": feat["geometry"],
            "properties": {
                "code": code,
                "name": code_to_name[code],
                "type": feat["properties"].get("Type_GN"),
            },
        })

    if unmapped:
        sys.exit(f"unmapped source names, add them to NAME_TO_CODE: {unmapped}")

    missing = expected_codes - matched_codes
    if missing:
        sys.exit(f"reference.json local levels with NO boundary geometry: {sorted(missing)}")

    extra = matched_codes - expected_codes
    if extra:
        sys.exit(f"matched codes not in reference.json (typo in NAME_TO_CODE?): {sorted(extra)}")

    geojson = {"type": "FeatureCollection", "features": out_features}
    OUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_GEOJSON.write_text(json.dumps(geojson, ensure_ascii=False), encoding="utf-8")

    print(f"wrote {OUT_GEOJSON.relative_to(ROOT)}")
    print(f"  {len(out_features)} local levels, all {len(expected_codes)} reference codes matched")
    print("  source: openknowledgenp/localboundaries (MIT) - Open Knowledge Nepal")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
