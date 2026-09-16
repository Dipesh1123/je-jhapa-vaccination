// Coverage figures for every palika and every ward, keyed by the same `code`
// values used in public/data/jhapa-*.geojson feature properties, so the
// frontend joins them client-side without another round trip per ward.

import { getBigQuery, DATASET, LOCATION } from "./_lib/bigquery.js";
import { flattenRow } from "./_lib/csv.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  try {
    const bq = getBigQuery();
    const [palikas, wards, facilities] = await Promise.all([
      bq.query({
        query: `SELECT * FROM \`${DATASET}.v_local_level_cumulative\``,
        location: LOCATION,
      }).then(([rows]) => rows),
      bq.query({
        query: `SELECT * FROM \`${DATASET}.v_ward_cumulative\``,
        location: LOCATION,
      }).then(([rows]) => rows),
      // Most recent report per distinct facility location, so a facility
      // that has reported on several days plots once, not once per report.
      bq.query({
        query: `
          SELECT facility_name, local_level_code, ward_no, facility_lat, facility_lon,
                 total_doses, report_date_ad
          FROM \`${DATASET}.v_reports\`
          WHERE facility_lat IS NOT NULL AND facility_lon IS NOT NULL
          QUALIFY ROW_NUMBER() OVER (
            -- BigQuery disallows PARTITION BY on a FLOAT64 expression directly.
            PARTITION BY CAST(ROUND(facility_lat, 5) AS STRING), CAST(ROUND(facility_lon, 5) AS STRING)
            ORDER BY report_date_ad DESC
          ) = 1
        `,
        location: LOCATION,
      }).then(([rows]) => rows),
    ]);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({
      palikas: palikas.map(flattenRow),
      wards: wards.map(flattenRow),
      facilities: facilities.map(flattenRow),
    });
  } catch (err) {
    console.error("map-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
