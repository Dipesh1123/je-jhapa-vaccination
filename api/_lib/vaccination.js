// Turns the raw Google Sheet into the same aggregates the old BigQuery views
// used to produce, in plain JS. Replaces scripts/bq_schema.sql entirely.

import { fetchAllPalikaTabs } from "./sheets.js";
import { LOCAL_LEVELS, LOCAL_LEVEL_BY_CODE, WARD_BY_CODE } from "./reference.js";
import { CAMPAIGN_START, CAMPAIGN_END, todayNpt } from "./campaign.js";

function cell(row, i) {
  const v = row[i];
  return v === undefined ? "" : v;
}

function numOrNull(v) {
  return v === "" || v === null || v === undefined ? null : Number(v);
}

function addDaysIso(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetweenIso(a, b) {
  const ms = new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function dayDate(dayIndex) {
  return addDaysIso(CAMPAIGN_START, dayIndex - 1);
}

/** One tab's raw 2D values -> { wardRows, dayBlocks }. A pure column-A state
 *  machine: a numeric col-A cell is a ward row, a col-A cell equal to "Total"
 *  ends the current block, a col-A cell starting with "Day " starts a new
 *  block. Everything else (titles, the repeated 3-row header, blank
 *  separators) falls through untouched, so this needs no per-palika row
 *  offsets and is unaffected by ward-count varying block height tab to tab.
 *  dayBlocks is a sparse map keyed by day index (1-11), not a fixed array -
 *  a day with no block yet is simply an absent key. */
function parseTab(rows) {
  const wardRows = [];
  const dayBlocks = {};
  let currentDay = null;
  let currentRows = null;

  for (const row of rows) {
    const a = cell(row, 0);

    if (typeof a === "number") {
      const wardRow = {
        ward_no: a,
        D: numOrNull(cell(row, 3)),
        E: numOrNull(cell(row, 4)),
        G: numOrNull(cell(row, 6)),
        H: numOrNull(cell(row, 7)),
      };
      if (currentDay === null) wardRows.push(wardRow);
      else currentRows.push(wardRow);
      continue;
    }

    if (typeof a === "string") {
      const text = a.trim();
      if (text === "Total") {
        if (currentDay !== null) {
          dayBlocks[currentDay] = currentRows;
          currentDay = null;
          currentRows = null;
        }
        continue;
      }
      const m = /^Day\s+(\d+)/.exec(text);
      if (m) {
        currentDay = parseInt(m[1], 10);
        currentRows = [];
        continue;
      }
      continue; // title row / repeated header / anything else - ignore
    }
    // blank col A (separator row) - ignore
  }

  if (currentDay !== null && currentRows && currentRows.length) {
    dayBlocks[currentDay] = currentRows; // tolerate a missing trailing "Total"
  }

  return { wardRows, dayBlocks };
}

let parsedCache = null; // { data, expiresAt } - mirrors sheets.js's own TTL

async function getParsedTabs() {
  const now = Date.now();
  if (parsedCache && parsedCache.expiresAt > now) return parsedCache.data;

  const raw = await fetchAllPalikaTabs();
  const parsed = {};
  for (const code of Object.keys(raw)) parsed[code] = parseTab(raw[code]);

  parsedCache = { data: parsed, expiresAt: Date.now() + 60_000 };
  return parsed;
}

function findWardRow(rows, wardNo) {
  return rows.find((r) => r.ward_no === wardNo) || null;
}

function totals(row) {
  if (!row) return { v_30_60_f: 0, v_30_60_m: 0, v_60plus_f: 0, v_60plus_m: 0, total_doses: 0 };
  const v_30_60_f = row.D ?? 0;
  const v_30_60_m = row.E ?? 0;
  const v_60plus_f = row.G ?? 0;
  const v_60plus_m = row.H ?? 0;
  return { v_30_60_f, v_30_60_m, v_60plus_f, v_60plus_m, total_doses: v_30_60_f + v_30_60_m + v_60plus_f + v_60plus_m };
}

function hasReport(row) {
  return !!row && (row.D !== null || row.E !== null || row.G !== null || row.H !== null);
}

/** Campaign day index (1-11) for `todayNpt()`, or null outside the window -
 *  same gating the old BigQuery-side campaignActive check did. */
function todayDayIndex() {
  const today = todayNpt();
  if (today < CAMPAIGN_START || today > CAMPAIGN_END) return null;
  return daysBetweenIso(CAMPAIGN_START, today) + 1;
}

function wardReportCount(dayBlocks, wardNo) {
  let count = 0;
  for (const dayIndex of Object.keys(dayBlocks)) {
    if (hasReport(findWardRow(dayBlocks[dayIndex], wardNo))) count++;
  }
  return count;
}

function wardLastReportDate(dayBlocks, wardNo) {
  let last = null;
  for (const dayIndex of Object.keys(dayBlocks).map(Number).sort((a, b) => a - b)) {
    if (hasReport(findWardRow(dayBlocks[dayIndex], wardNo))) last = dayIndex;
  }
  return last === null ? null : dayDate(last);
}

export async function computeWardSummary(wardCode) {
  const entry = WARD_BY_CODE[wardCode];
  if (!entry) return null;
  const { localLevel, ward } = entry;
  const parsed = await getParsedTabs();
  const tab = parsed[localLevel.code];
  const cum = totals(findWardRow(tab.wardRows, ward.ward_no));
  const reportCount = wardReportCount(tab.dayBlocks, ward.ward_no);

  return {
    ward_code: ward.code,
    local_level_code: localLevel.code,
    local_level_name: localLevel.name,
    ward_no: ward.ward_no,
    population: ward.population,
    je_target: ward.je_target,
    ...cum,
    coverage_pct: ward.je_target > 0 ? (cum.total_doses / ward.je_target) * 100 : 0,
    report_count: reportCount,
    last_report_date: wardLastReportDate(tab.dayBlocks, ward.ward_no),
  };
}

export async function computePalikaSummary(localLevelCode) {
  const localLevel = LOCAL_LEVEL_BY_CODE[localLevelCode];
  if (!localLevel) return null;
  const parsed = await getParsedTabs();
  const tab = parsed[localLevelCode];

  let v_30_60_f = 0, v_30_60_m = 0, v_60plus_f = 0, v_60plus_m = 0, total_doses = 0, wardsReporting = 0;
  for (const ward of localLevel.wards) {
    const cum = totals(findWardRow(tab.wardRows, ward.ward_no));
    v_30_60_f += cum.v_30_60_f;
    v_30_60_m += cum.v_30_60_m;
    v_60plus_f += cum.v_60plus_f;
    v_60plus_m += cum.v_60plus_m;
    total_doses += cum.total_doses;
    if (wardReportCount(tab.dayBlocks, ward.ward_no) > 0) wardsReporting++;
  }

  return {
    local_level_code: localLevel.code,
    local_level_name: localLevel.name,
    population: localLevel.population,
    je_target: localLevel.je_target,
    ward_count: localLevel.ward_count,
    v_30_60_f, v_30_60_m, v_60plus_f, v_60plus_m, total_doses,
    wards_reporting: wardsReporting,
    coverage_pct: localLevel.je_target > 0 ? (total_doses / localLevel.je_target) * 100 : 0,
  };
}

export async function computeAllPalikaSummaries() {
  return Promise.all(LOCAL_LEVELS.map((l) => computePalikaSummary(l.code)));
}

export async function computeAllWardSummaries() {
  const wardCodes = LOCAL_LEVELS.flatMap((l) => l.wards.map((w) => w.code));
  return Promise.all(wardCodes.map((c) => computeWardSummary(c)));
}

/** District-wide daily trend: for every day index seen in any palika's
 *  tab, sum that day's doses/breakdown across every ward that has a row for
 *  it, then a running cumulative total across days in order. report_count
 *  and wards_reporting collapse to the same number here - unlike raw KoBo
 *  submissions, a manually-maintained sheet has no concept of more than one
 *  submission per ward per day. */
export async function computeDailyTrend(filter) {
  const parsed = await getParsedTabs();
  const localLevels = filter ? [LOCAL_LEVEL_BY_CODE[filter.localLevelCode]] : LOCAL_LEVELS;
  const dayIndices = new Set();
  for (const l of localLevels) {
    for (const dayIndex of Object.keys(parsed[l.code].dayBlocks)) dayIndices.add(Number(dayIndex));
  }

  const days = [...dayIndices].sort((a, b) => a - b).map((dayIndex) => {
    let v_30_60_f = 0, v_30_60_m = 0, v_60plus_f = 0, v_60plus_m = 0, doses = 0, wardsReporting = 0;
    for (const l of localLevels) {
      const block = parsed[l.code].dayBlocks[dayIndex] || [];
      const wards = filter?.wardNo != null ? l.wards.filter((w) => w.ward_no === filter.wardNo) : l.wards;
      for (const ward of wards) {
        const row = findWardRow(block, ward.ward_no);
        if (!hasReport(row)) continue;
        const t = totals(row);
        v_30_60_f += t.v_30_60_f; v_30_60_m += t.v_30_60_m;
        v_60plus_f += t.v_60plus_f; v_60plus_m += t.v_60plus_m;
        doses += t.total_doses;
        wardsReporting++;
      }
    }
    return { report_date_ad: dayDate(dayIndex), doses, v_30_60_f, v_30_60_m, v_60plus_f, v_60plus_m, report_count: wardsReporting, wards_reporting: wardsReporting };
  });

  const jeTarget = filter
    ? filter.wardNo != null
      ? WARD_BY_CODE[`${filter.localLevelCode}_${filter.wardNo}`]?.ward.je_target ?? 0
      : LOCAL_LEVEL_BY_CODE[filter.localLevelCode]?.je_target ?? 0
    : LOCAL_LEVELS.reduce((sum, l) => sum + l.je_target, 0);

  let running = 0;
  return days.map((d) => {
    running += d.doses;
    return {
      ...d,
      cumulative_doses: running,
      cumulative_coverage_pct: jeTarget > 0 ? (running / jeTarget) * 100 : 0,
    };
  });
}

/** District-wide age x sex breakdown, cumulative to date. */
export async function computeAgeSexBreakdown(filter) {
  const parsed = await getParsedTabs();
  const localLevels = filter ? [LOCAL_LEVEL_BY_CODE[filter.localLevelCode]] : LOCAL_LEVELS;
  let v_30_60_f = 0, v_30_60_m = 0, v_60plus_f = 0, v_60plus_m = 0;
  for (const l of localLevels) {
    const tab = parsed[l.code];
    const wards = filter?.wardNo != null ? l.wards.filter((w) => w.ward_no === filter.wardNo) : l.wards;
    for (const ward of wards) {
      const t = totals(findWardRow(tab.wardRows, ward.ward_no));
      v_30_60_f += t.v_30_60_f; v_30_60_m += t.v_30_60_m;
      v_60plus_f += t.v_60plus_f; v_60plus_m += t.v_60plus_m;
    }
  }
  return [
    { age_band: "age_30_60", sex: "female", doses: v_30_60_f },
    { age_band: "age_30_60", sex: "male", doses: v_30_60_m },
    { age_band: "age_60_plus", sex: "female", doses: v_60plus_f },
    { age_band: "age_60_plus", sex: "male", doses: v_60plus_m },
  ];
}

/** Wards with no entry at all (blank D/E/G/H) in today's day-block. Returns
 *  null outside the campaign window - before day 1 every ward legitimately
 *  has nothing to report yet, same reasoning the old view used. */
export async function notReportingWardsForToday() {
  const dayIndex = todayDayIndex();
  if (dayIndex === null) return null;
  const parsed = await getParsedTabs();
  const wards = [];
  for (const l of LOCAL_LEVELS) {
    const block = parsed[l.code].dayBlocks[dayIndex] || [];
    for (const ward of l.wards) {
      if (!hasReport(findWardRow(block, ward.ward_no))) {
        wards.push({
          ward_code: ward.code,
          local_level_code: l.code,
          local_level_name: l.name,
          ward_no: ward.ward_no,
          population: ward.population,
          last_report_date: wardLastReportDate(parsed[l.code].dayBlocks, ward.ward_no),
        });
      }
    }
  }
  return { today: dayDate(dayIndex), wards };
}
