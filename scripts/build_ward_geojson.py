"""Builds public/data/jhapa-wards.geojson: all 131 Jhapa ward polygons,
re-keyed to our ref_ward.code scheme ({local_level_code}_{ward_no}).

Source: SaugatPdl/nepal-administrative-boundary-shapefiles on GitHub,
Ward/5_NepalWards.shp. NOT an official Survey Department dataset - the
repo has no LICENSE file and its own README says the data is "compiled
from publicly available and open sources ... not intended for legal or
official boundary verification." Counted and cross-checked against
data/reference.json before writing anything: 131/131 wards present for
Jhapa, ward-count-per-local-level matches exactly (e.g. Mechinagar 15,
Haldibari 5).

CRS: despite the repo's README claiming EPSG:4326 for every layer, the
Ward shapefile's own .prj is "Nepal_MUTM_Central_84_Everest_1830" - a
projected system on the Everest 1830 ellipsoid (Nepal's Survey
Department system), not lon/lat degrees. pyproj's ellipsoid-only
transform (no towgs84 in the .prj, so no datum shift) landed every one
of the 15 local levels about 220m off from jhapa-palikas.geojson
(MIT-licensed, independently sourced) in almost exactly the same
direction - stdev under 3m across all 15, i.e. a near-constant
translation, not random error or a rotation/scale mismatch. A published
towgs84 triple for Everest 1830 (295.7, 735.9, 257.8) was tried and
made it *worse* (~490m), so rather than guess further public-domain
datum parameters, DATUM_SHIFT_DEG below is fitted directly against our
own trusted palika boundaries: the mean centroid offset, averaged over
all 15 local levels. Residual after applying it is a few metres per
local level - see scripts/validate_ward_geojson.py.

Requires `pyshp` and `pyproj` (pip install pyshp pyproj) and a local
clone of the source repo, since it ships shapefiles rather than GeoJSON:
  git clone https://github.com/SaugatPdl/nepal-administrative-boundary-shapefiles.git

Run:  python scripts/build_ward_geojson.py <path-to-cloned-repo>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pyproj
import shapefile

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / "data" / "reference.json"
OUT_GEOJSON = ROOT / "public" / "data" / "jhapa-wards.geojson"

# Same source-name -> our-code mapping as build_palika_geojson.py - this
# shapefile's GaPa_NaPa field uses the identical spellings.
NAME_TO_CODE = {
    "Arjundhara": "arjundhara_municipality",
    "Barhadashi": "barhadashi_gaunpalika",
    "Bhadrapur": "bhadrapur_municipality",
    "Birtamod": "birtamod_municipality",
    "Buddhashanti": "buddhashanti_gaunpalika",
    "Damak": "damak_municipality",
    "Gauradhaha": "gauradaha_municipality",
    "Gauriganj": "gauriganj_gaunpalika",
    "Haldibari": "haldibari_gaunpalika",
    "Jhapa": "jhapa_gaunpalika",
    "Kachankawal": "kachanakawal_gaunpalika",
    "Kamal": "kamal_gaunpalika",
    "Kankai": "kankai_municipality",
    "Mechinagar": "mechinagar_municipality",
    "Shivasataxi": "shivasatakshi_municipality",
}


def main() -> int:
    if len(sys.argv) != 2:
        sys.exit("usage: python scripts/build_ward_geojson.py <path-to-cloned-repo>")
    repo = Path(sys.argv[1])
    shp_path = repo / "Ward" / "5_NepalWards.shp"
    if not shp_path.exists():
        sys.exit(f"not found: {shp_path}")

    reference = json.loads(REFERENCE.read_text(encoding="utf-8"))
    expected_ward_codes = {
        w["code"]
        for ll in reference["local_levels"]
        for w in ll["wards"]
    }

    sf = shapefile.Reader(str(shp_path))
    fields = [f[0] for f in sf.fields[1:]]
    src_crs = pyproj.CRS.from_wkt(Path(str(shp_path)[:-4] + ".prj").read_text())
    to_wgs84 = pyproj.Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)

    # Fitted against jhapa-palikas.geojson - see this file's docstring.
    DATUM_SHIFT_DEG = (0.0022022530687536347, -0.0001249447854417459)  # (lon, lat)

    def reproject_ring(ring: list) -> list:
        return [
            [lon + DATUM_SHIFT_DEG[0], lat + DATUM_SHIFT_DEG[1]]
            for lon, lat in (to_wgs84.transform(x, y) for x, y in ring)
        ]

    out_features = []
    matched_codes = set()
    unmapped_names = set()

    for i in range(len(sf)):
        rec = dict(zip(fields, sf.record(i)))
        if str(rec.get("DISTRICT", "")).strip().upper() != "JHAPA":
            continue

        source_name = rec.get("GaPa_NaPa")
        ll_code = NAME_TO_CODE.get(source_name)
        if ll_code is None:
            unmapped_names.add(source_name)
            continue

        ward_no = int(rec["NEW_WARD_N"])
        ward_code = f"{ll_code}_{ward_no}"
        matched_codes.add(ward_code)

        shp = sf.shape(i)
        parts = list(shp.parts) + [len(shp.points)]
        rings = [reproject_ring(shp.points[parts[j]:parts[j + 1]]) for j in range(len(parts) - 1)]

        out_features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": rings},
            "properties": {
                "code": ward_code,
                "local_level_code": ll_code,
                "ward_no": ward_no,
                "is_official": False,
            },
        })

    if unmapped_names:
        sys.exit(f"unmapped source names, add them to NAME_TO_CODE: {sorted(unmapped_names)}")

    missing = expected_ward_codes - matched_codes
    if missing:
        sys.exit(f"reference.json wards with NO boundary geometry: {sorted(missing)}")

    extra = matched_codes - expected_ward_codes
    if extra:
        sys.exit(f"matched ward codes not in reference.json (duplicate ward numbers?): {sorted(extra)}")

    geojson = {"type": "FeatureCollection", "features": out_features}
    OUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_GEOJSON.write_text(json.dumps(geojson, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"wrote {OUT_GEOJSON.relative_to(ROOT)}")
    print(f"  {len(out_features)} wards, all {len(expected_ward_codes)} reference ward codes matched")
    print("  source: SaugatPdl/nepal-administrative-boundary-shapefiles (GitHub, no formal license)")
    print("  reprojected from Nepal_MUTM_Central_84_Everest_1830 to WGS84 - run")
    print("  scripts/validate_ward_geojson.py next to check alignment against jhapa-palikas.geojson")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
