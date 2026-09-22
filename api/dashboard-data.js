// Everything a dashboard view needs in one round trip: KPI summary, the daily
// trend, the age x sex breakdown, and a breakdown table - district-wide by
// default, or scoped to one local level / one ward via ?scope=&code=.
//
// All aggregation happens in api/_lib/vaccination.js over the Google Sheet
// (api/_lib/sheets.js) plus data/reference.json for population/JE-target.

import { REFERENCE, LOCAL_LEVEL_BY_CODE, WARD_BY_CODE } from "./_lib/reference.js";
import { CAMPAIGN_START, CAMPAIGN_END } from "./_lib/campaign.js";
import {
  computePalikaSummary,
  computeAllPalikaSummaries,
  computeWardSummary,
  computeDailyTrend,
  computeAgeSexBreakdown,
  notReportingWardsForToday,
} from "./_lib/vaccination.js";

async function districtScope() {
  const [daily, ageSex, palikas, notReportingToday] = await Promise.all([
    computeDailyTrend(),
    computeAgeSexBreakdown(),
    computeAllPalikaSummaries(),
    notReportingWardsForToday(),
  ]);

  const vaccinated = daily.length > 0 ? daily[daily.length - 1].cumulative_doses : 0;

  return {
    scope: "district",
    code: null,
    name: null,
    ward_no: null,
    summary: {
      population: REFERENCE.population,
      je_target: REFERENCE.je_target,
      vaccinated,
      coverage_pct: REFERENCE.je_target > 0 ? (vaccinated / REFERENCE.je_target) * 100 : 0,
      campaign_start: CAMPAIGN_START,
      campaign_end: CAMPAIGN_END,
    },
    daily,
    ageSex,
    palikas,
    wards: null,
    notReportingToday,
  };
}

async function narrowScope(scope, code) {
  if (scope === "local_level") {
    const summary = await computePalikaSummary(code);
    if (!summary) return null;
    const localLevel = LOCAL_LEVEL_BY_CODE[code];
    const [daily, ageSex, wards] = await Promise.all([
      computeDailyTrend({ localLevelCode: code }),
      computeAgeSexBreakdown({ localLevelCode: code }),
      Promise.all(localLevel.wards.map((w) => computeWardSummary(w.code))),
    ]);

    return {
      scope,
      code,
      name: summary.local_level_name,
      ward_no: null,
      summary: {
        population: summary.population,
        je_target: summary.je_target,
        vaccinated: summary.total_doses,
        coverage_pct: summary.coverage_pct,
        campaign_start: CAMPAIGN_START,
        campaign_end: CAMPAIGN_END,
      },
      daily,
      ageSex,
      palikas: null,
      wards,
      notReportingToday: null,
    };
  }

  // scope === "ward"
  const entry = WARD_BY_CODE[code];
  if (!entry) return null;
  const { localLevel, ward } = entry;
  const [summary, daily, ageSex] = await Promise.all([
    computeWardSummary(code),
    computeDailyTrend({ localLevelCode: localLevel.code, wardNo: ward.ward_no }),
    computeAgeSexBreakdown({ localLevelCode: localLevel.code, wardNo: ward.ward_no }),
  ]);

  return {
    scope,
    code,
    name: summary.local_level_name,
    ward_no: summary.ward_no,
    summary: {
      population: summary.population,
      je_target: summary.je_target,
      vaccinated: summary.total_doses,
      coverage_pct: summary.coverage_pct,
      campaign_start: CAMPAIGN_START,
      campaign_end: CAMPAIGN_END,
    },
    daily,
    ageSex,
    palikas: null,
    wards: null,
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
    const payload = scope === "district" ? await districtScope() : await narrowScope(scope, code);

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
