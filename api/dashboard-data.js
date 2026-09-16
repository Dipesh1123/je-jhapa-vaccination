// Everything the homepage needs in one round trip: district KPIs, the daily
// trend, the age x sex breakdown, and the palika league table. One request
// instead of four keeps this well inside BigQuery's free tier even if the
// dashboard gets shared widely (it's fully public, so it will be).
//
// All aggregation happens in BigQuery views (scripts/bq_schema.sql) - this
// route does not compute a single sum itself, only shapes the response.

import { getBigQuery, DATASET, LOCATION } from "./_lib/bigquery.js";
import { CAMPAIGN_START, CAMPAIGN_END } from "./_lib/campaign.js";
import { flattenRow } from "./_lib/csv.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  try {
    const bq = getBigQuery();

    const [[districtTarget], daily, ageSex, palikas] = await Promise.all([
      bq.query({
        query: `SELECT SUM(je_target) AS je_target, SUM(population) AS population
                FROM \`${DATASET}.ref_local_level\``,
        location: LOCATION,
      }).then(([rows]) => rows),
      bq.query({
        query: `SELECT * FROM \`${DATASET}.v_district_daily\` ORDER BY report_date_ad`,
        location: LOCATION,
      }).then(([rows]) => rows),
      bq.query({
        query: `SELECT * FROM \`${DATASET}.v_age_sex_breakdown\``,
        location: LOCATION,
      }).then(([rows]) => rows),
      bq.query({
        query: `SELECT * FROM \`${DATASET}.v_local_level_cumulative\` ORDER BY local_level_name`,
        location: LOCATION,
      }).then(([rows]) => rows),
    ]);

    const vaccinated = daily.length > 0 ? Number(daily[daily.length - 1].cumulative_doses) : 0;
    const jeTarget = Number(districtTarget.je_target);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({
      district: {
        population: Number(districtTarget.population),
        je_target: jeTarget,
        vaccinated,
        coverage_pct: jeTarget > 0 ? (vaccinated / jeTarget) * 100 : 0,
        campaign_start: CAMPAIGN_START,
        campaign_end: CAMPAIGN_END,
      },
      daily: daily.map(flattenRow),
      ageSex: ageSex.map(flattenRow),
      palikas: palikas.map(flattenRow),
    });
  } catch (err) {
    console.error("dashboard-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
