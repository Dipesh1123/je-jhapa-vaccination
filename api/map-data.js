// Coverage figures for every palika and every ward, keyed by the same `code`
// values used in public/data/jhapa-*.geojson feature properties, so the
// frontend joins them client-side without another round trip per ward.
//
// No facility-points layer here anymore - that read raw geolocated KoBo
// submissions, which have no equivalent in the manually-maintained sheet.

import { computeAllPalikaSummaries, computeAllWardSummaries } from "./_lib/vaccination.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  try {
    const [palikas, wards] = await Promise.all([
      computeAllPalikaSummaries(),
      computeAllWardSummaries(),
    ]);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({ palikas, wards });
  } catch (err) {
    console.error("map-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
