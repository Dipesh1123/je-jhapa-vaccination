"""Cross-checks public/data/jhapa-wards.geojson against
public/data/jhapa-palikas.geojson (MIT-licensed, independently sourced):
unions the wards belonging to each local level and compares the result to
that local level's own boundary polygon. If build_ward_geojson.py's
ellipsoid-only reprojection had a real datum-shift error, this would show
up as a large, consistent offset between the two - this script measures it.

Run:  python scripts/validate_ward_geojson.py
"""
import json
from pathlib import Path
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent

wards = json.loads((ROOT / "public/data/jhapa-wards.geojson").read_text(encoding="utf-8"))
palikas = json.loads((ROOT / "public/data/jhapa-palikas.geojson").read_text(encoding="utf-8"))

palika_geom = {f["properties"]["code"]: shape(f["geometry"]) for f in palikas["features"]}

by_ll: dict[str, list] = {}
for f in wards["features"]:
    by_ll.setdefault(f["properties"]["local_level_code"], []).append(shape(f["geometry"]))

print(f"{'local level':<28} {'centroid offset (m)':>20} {'IoU':>8}")
worst = 0.0
for code, geoms in sorted(by_ll.items()):
    ward_union = unary_union(geoms).buffer(0)
    ref = palika_geom.get(code)
    if ref is None:
        print(f"{code:<28} NOT IN jhapa-palikas.geojson")
        continue

    # Rough metres-per-degree at this latitude (~26.5N) - good enough for a
    # sanity check, not a survey-grade distance calculation.
    lat = ref.centroid.y
    m_per_deg_lat = 111_320
    m_per_deg_lon = 111_320 * abs(__import__("math").cos(__import__("math").radians(lat)))
    dx = (ward_union.centroid.x - ref.centroid.x) * m_per_deg_lon
    dy = (ward_union.centroid.y - ref.centroid.y) * m_per_deg_lat
    offset_m = (dx**2 + dy**2) ** 0.5

    inter = ward_union.intersection(ref).area
    union = ward_union.union(ref).area
    iou = inter / union if union else 0.0

    worst = max(worst, offset_m)
    print(f"{code:<28} {offset_m:>18.1f}m {iou:>8.3f}")

print()
print(f"worst centroid offset: {worst:.1f}m")
print("IoU close to 1.0 = the unioned wards closely match the palika's own boundary shape.")
