// Pre-launch readiness check against the live BigQuery dataset - the plan's
// "Verification" items that can be checked from here, in one run. Safe to
// re-run any time; it only reads.
//
//   vercel env pull .env.production --environment=production
//   node scripts/preflight_check.mjs .env.production
//   rm .env.production

import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPAIGN_START, CAMPAIGN_END } from "../api/_lib/campaign.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) process.env[match[1]] ??= match[2];
  }
}

const envFile = process.argv[2];
if (envFile) loadEnvFile(resolve(envFile));

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT_B64, "base64").toString("utf-8")),
});
const location = process.env.BQ_LOCATION || "asia-south1";
const q = async (sql) => (await bq.query({ query: sql, location }))[0];

const checks = [];
const check = (label, ok, detail) => checks.push({ label, ok, detail });

// --- denominators -----------------------------------------------------------
const [ward] = await q(`
  SELECT COUNT(*) AS wards, SUM(population) AS population, SUM(je_target) AS je_target
  FROM \`je_jhapa.ref_ward\``);
const [ll] = await q(`
  SELECT COUNT(*) AS local_levels, SUM(population) AS population, SUM(je_target) AS je_target
  FROM \`je_jhapa.ref_local_level\``);

check("ref_ward has all 131 wards", Number(ward.wards) === 131, `${ward.wards}`);
check("ref_local_level has all 15 local levels", Number(ll.local_levels) === 15, `${ll.local_levels}`);
check("district population is 1,027,747", Number(ward.population) === 1_027_747, `${ward.population}`);
check("district JE target rounds to 493,319", Math.round(Number(ward.je_target)) === 493_319, `${ward.je_target}`);
check(
  "ward sums reconcile to local-level sums",
  Number(ward.population) === Number(ll.population) &&
    Math.abs(Number(ward.je_target) - Number(ll.je_target)) < 0.01,
  `wards ${ward.population}/${ward.je_target} vs local levels ${ll.population}/${ll.je_target}`
);

// --- referential integrity --------------------------------------------------
const orphans = await q(`
  SELECT w.code FROM \`je_jhapa.ref_ward\` w
  LEFT JOIN \`je_jhapa.ref_local_level\` l ON l.code = w.local_level_code
  WHERE l.code IS NULL`);
check("every ward maps to a real local level", orphans.length === 0, `${orphans.length} orphan(s)`);

const misKeyed = await q(`
  SELECT code FROM \`je_jhapa.ref_ward\`
  WHERE code != CONCAT(local_level_code, '_', CAST(ward_no AS STRING))`);
check("ward codes follow {local_level_code}_{ward_no}", misKeyed.length === 0, `${misKeyed.length} mismatch(es)`);

// --- views ------------------------------------------------------------------
const VIEWS = [
  "v_reports", "v_ward_cumulative", "v_local_level_cumulative",
  "v_district_daily", "v_age_sex_breakdown", "v_commodity_stock", "v_duplicate_review",
];
for (const view of VIEWS) {
  try {
    await q(`SELECT * FROM \`je_jhapa.${view}\` LIMIT 1`);
    check(`view ${view} is queryable`, true, "");
  } catch (err) {
    check(`view ${view} is queryable`, false, err.message.split("\n")[0]);
  }
}

// --- live data state --------------------------------------------------------
const [reports] = await q("SELECT COUNT(*) AS n FROM `je_jhapa.reports`");
check("reports table holds no leftover test data", Number(reports.n) === 0, `${reports.n} row(s)`);

// --- campaign window --------------------------------------------------------
const reference = JSON.parse(readFileSync(resolve(ROOT, "data/reference.json"), "utf-8"));
check(
  "campaign dates match between reference.json and api/_lib/campaign.js",
  reference.campaign_start === CAMPAIGN_START && reference.campaign_end === CAMPAIGN_END,
  `reference.json ${reference.campaign_start}..${reference.campaign_end} vs code ${CAMPAIGN_START}..${CAMPAIGN_END}`
);

// --- report -----------------------------------------------------------------
let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.label}${c.detail && !c.ok ? `  -> ${c.detail}` : ""}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
