// Public CSV of the ward-level roll-up - the aggregate the dataviz skill's
// "table view" fallback and the plan's "download the aggregate data" ask for.

import { toCsv } from "./_lib/csv.js";
import { computeAllWardSummaries } from "./_lib/vaccination.js";

const COLUMNS = [
  "local_level_name", "ward_no", "population", "je_target",
  "v_30_60_f", "v_30_60_m", "v_60plus_f", "v_60plus_m",
  "total_doses", "coverage_pct",
  "report_count", "last_report_date",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  try {
    const wards = await computeAllWardSummaries();
    wards.sort((a, b) => a.local_level_name.localeCompare(b.local_level_name) || a.ward_no - b.ward_no);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="je_jhapa_ward_aggregate.csv"');
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).send(toCsv(wards, COLUMNS));
  } catch (err) {
    console.error("export-aggregate failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
