// Public CSV of every facility-day report - the full detail the plan calls
// "download the line listing." Public because the scope changed: no login
// anywhere, including this route.

import { getBigQuery, DATASET, LOCATION } from "./_lib/bigquery.js";
import { toCsv, flattenRow } from "./_lib/csv.js";

const COLUMNS = [
  "report_date_ad", "local_level_code", "ward_no", "facility_name",
  "reporter_name", "reporter_designation", "reporter_phone",
  "v_30_60_f", "v_30_60_m", "v_60plus_f", "v_60plus_m", "total_doses",
  "doses_per_vial", "vaccine_used", "vials_discarded", "doses_available", "wastage_rate",
  "vaccine_closing", "diluent_closing", "ad_syr_closing", "recon_syr_closing", "safety_box_closing",
  "aefi_minor", "aefi_serious", "aefi_remarks", "remarks",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  try {
    const bq = getBigQuery();
    const [rows] = await bq.query({
      query: `SELECT * FROM \`${DATASET}.v_reports\` ORDER BY report_date_ad, local_level_code, ward_no`,
      location: LOCATION,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="je_jhapa_facility_reports.csv"');
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).send(toCsv(rows.map(flattenRow), COLUMNS));
  } catch (err) {
    console.error("export-detail failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
