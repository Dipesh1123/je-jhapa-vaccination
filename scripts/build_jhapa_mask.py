"""Builds public/data/jhapa-mask.geojson: a world-covering polygon with
Jhapa district's outline cut out as a hole, so the map can dim everything
outside the district instead of only restricting the camera bounds.

Input: public/data/jhapa-palikas.geojson (15 palika polygons, adjacent with
shared borders - scripts/build_palika_geojson.py). Unioning them dissolves
the internal palika-to-palika borders, leaving just the district outline.
"""
import json
from pathlib import Path
from shapely.geometry import shape, mapping, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "data" / "jhapa-palikas.geojson"
OUT = ROOT / "public" / "data" / "jhapa-mask.geojson"

with open(SRC, encoding="utf-8") as f:
    gj = json.load(f)

geoms = [shape(f["geometry"]) for f in gj["features"]]
district = unary_union(geoms)
district = district.buffer(0)  # clean up any topology slivers from the union

# One outer ring (covers the whole world so the mask never runs out at any
# zoom/pan the maxBounds allows) with every polygon-ring of the district as
# a hole. unary_union of 15 adjacent polygons is normally a single Polygon,
# but handle MultiPolygon defensively in case of a sliver gap in the source data.
outer = [(-180, -90), (-180, 90), (180, 90), (180, -90), (-180, -90)]
if district.geom_type == "Polygon":
    holes = [list(district.exterior.coords)]
else:
    holes = [list(p.exterior.coords) for p in district.geoms]

mask_polygon = Polygon(outer, holes=holes)

out = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "properties": {},
        "geometry": mapping(mask_polygon),
    }],
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f)

print(f"wrote {OUT} ({OUT.stat().st_size} bytes), district area rings: {len(holes)}")
