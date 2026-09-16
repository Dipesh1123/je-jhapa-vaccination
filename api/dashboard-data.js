// Everything a dashboard view needs in one round trip: KPI summary, the daily
// trend, the age x sex breakdown, and a breakdown table - district-wide by
// default, or scoped to one local level / one ward via ?scope=&code=. One
// request instead of several keeps this well inside BigQuery's free tier
// even if the dashboard gets shared widely (it's fully public, so it will be).
//
// All aggregation happens in BigQuery views (scripts/bq_schema.sql) for the
// unscoped case; the scoped cases reuse the same v_reports dedup base with a
// WHERE clause, since a per-local-level/per-ward daily trend isn't something
// a static view can parameterize.

import { getBigQuery, DATASET, LOCATION } from "./_lib/bigquery.js";
import { CAMPAIGN_START, CAMPAIGN_END, todayNpt } from "./_lib/campaign.js";
import { flattenRow } from "./_lib/csv.js";

async function districtScope(bq) {
  const today = todayNpt();
  // Only meaningful once the campaign is actually running - before day 1
  // every ward legitimately has nothing to report yet, and the list would
  // just be "all 131" every single day pre-launch.
  const campaignActive = today >= CAMPAIGN_START && today <= CAMPAIGN_END;

  const [[districtTarget], daily, ageSex, palikas, duplicates, notReportingToday] = await Promise.all([
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
    bq.query({
      query: `SELECT * FROM \`${DATASET}.v_duplicate_review\` ORDER BY report_date_ad DESC, local_level_name, ward_no`,
      location: LOCATION,
    }).then(([rows]) => rows),
    campaignActive
      ? bq.query({
          query: `
            SELECT ward_code, local_level_code, local_level_name, ward_no, population, last_report_date
            FROM \`${DATASET}.v_ward_cumulative\`
            WHERE last_report_date IS NULL OR last_report_date != CAST(@today AS DATE)
            ORDER BY local_level_name, ward_no`,
          params: { today },
          location: LOCATION,
        }).then(([rows]) => rows)
      : Promise.resolve([]),
  ]);

  const vaccinated = daily.length > 0 ? Number(daily[daily.length - 1].cumulative_doses) : 0;
  const jeTarget = Number(districtTarget.je_target);

  return {
    scope: "district",
    code: null,
    name: null,
    ward_no: null,
    summary: {
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
    wards: null,
    duplicates: duplicates.map(flattenRow),
    notReportingToday: campaignActive ? { today, wards: notReportingToday.map(flattenRow) } : null,
  };
}

async function narrowScope(bq, scope, code) {
  const summaryTable = scope === "local_level" ? "v_local_level_cumulative" : "v_ward_cumulative";
  const summaryWhere = scope === "local_level" ? "local_level_code = @code" : "ward_code = @code";
  const refTable = scope === "local_level" ? "ref_local_level" : "ref_ward";
  const reportsWhere = scope === "local_level" ? "local_level_code = @code" : "ward_code = @code";

  const [[summaryRow], dailyRows, [ageSexRow], wards] = await Promise.all([
    bq.query({
      query: `SELECT * FROM \`${DATASET}.${summaryTable}\` WHERE ${summaryWhere}`,
      params: { code },
      location: LOCATION,
    }).then(([rows]) => rows),
    bq.query({
      query: `
        WITH daily AS (
          SELECT
            report_date_ad,
            SUM(total_doses)          AS doses,
            SUM(v_30_60_f)            AS v_30_60_f,
            SUM(v_30_60_m)            AS v_30_60_m,
            SUM(v_60plus_f)           AS v_60plus_f,
            SUM(v_60plus_m)           AS v_60plus_m,
            COUNT(*)                  AS report_count,
            COUNT(DISTINCT ward_code) AS wards_reporting
          FROM \`${DATASET}.v_reports\`
          WHERE ${reportsWhere}
          GROUP BY report_date_ad
        ),
        target AS (SELECT je_target FROM \`${DATASET}.${refTable}\` WHERE code = @code)
        SELECT
          d.*,
          SUM(d.doses) OVER (ORDER BY d.report_date_ad) AS cumulative_doses,
          SAFE_DIVIDE(SUM(d.doses) OVER (ORDER BY d.report_date_ad), t.je_target) * 100
            AS cumulative_coverage_pct
        FROM daily d CROSS JOIN target t
        ORDER BY d.report_date_ad`,
      params: { code },
      location: LOCATION,
    }).then(([rows]) => rows),
    bq.query({
      query: `
        SELECT
          COALESCE(SUM(v_30_60_f),  0) AS v_30_60_f,
          COALESCE(SUM(v_30_60_m),  0) AS v_30_60_m,
          COALESCE(SUM(v_60plus_f), 0) AS v_60plus_f,
          COALESCE(SUM(v_60plus_m), 0) AS v_60plus_m
        FROM \`${DATASET}.v_reports\` WHERE ${reportsWhere}`,
      params: { code },
      location: LOCATION,
    }).then(([rows]) => rows),
    scope === "local_level"
      ? bq.query({
          query: `SELECT * FROM \`${DATASET}.v_ward_cumulative\` WHERE local_level_code = @code ORDER BY ward_no`,
          params: { code },
          location: LOCATION,
        }).then(([rows]) => rows)
      : Promise.resolve(null),
  ]);

  if (!summaryRow) return null;

  const summary = flattenRow(summaryRow);
  const ageSex = [
    { age_band: "age_30_60", sex: "female", doses: Number(ageSexRow.v_30_60_f) },
    { age_band: "age_30_60", sex: "male", doses: Number(ageSexRow.v_30_60_m) },
    { age_band: "age_60_plus", sex: "female", doses: Number(ageSexRow.v_60plus_f) },
    { age_band: "age_60_plus", sex: "male", doses: Number(ageSexRow.v_60plus_m) },
  ];

  return {
    scope,
    code,
    name: summary.local_level_name,
    ward_no: scope === "ward" ? summary.ward_no : null,
    summary: {
      population: summary.population,
      je_target: summary.je_target,
      vaccinated: summary.total_doses,
      coverage_pct: summary.coverage_pct,
      campaign_start: CAMPAIGN_START,
      campaign_end: CAMPAIGN_END,
    },
    daily: dailyRows.map(flattenRow),
    ageSex,
    palikas: null,
    wards: wards ? wards.map(flattenRow) : null,
    duplicates: null,
    notReportingToday: null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  const scope = req.query.scope === "local_level" || req.query.scope === "ward" ? req.query.scope : "district";
  const code = req.query.code;
  if (scope !== "district" && (!code || typeof code !== "string")) {
    res.status(400).json({ error: "missing ?code= for a scoped request" });
    return;
  }

  try {
    const bq = getBigQuery();
    const payload = scope === "district" ? await districtScope(bq) : await narrowScope(bq, scope, code);

    if (!payload) {
      res.status(404).json({ error: `no ${scope} with code '${code}'` });
      return;
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json(payload);
  } catch (err) {
    console.error("dashboard-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
