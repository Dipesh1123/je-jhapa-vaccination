// Checks the two-pass de-duplication in v_reports (see scripts/bq_schema.sql)
// against a set of hand-built cases covering every way a facility-day can show
// up more than once: a redelivered _uuid, an offline resubmission typed with a
// different spelling of the same facility name, a genuine correction, a second
// facility in the same ward, and the same facility on the next day.
//
// The cases run against literal rows rather than the `reports` table, because
// `reports` feeds a live public dashboard and must never carry test data. That
// means the window functions below are a copy of the ones in the view - if you
// change the view, change them here too and re-run.
//
//   vercel env pull .env.production --environment=production
//   node scripts/validate_dedup.mjs .env.production
//   rm .env.production

import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) process.env[match[1]] ??= match[2];
  }
}

const envFile = process.argv[2];
if (envFile) loadEnvFile(resolve(envFile));

const b64 = process.env.GCP_SERVICE_ACCOUNT_B64;
if (!b64) {
  console.error("GCP_SERVICE_ACCOUNT_B64 is not set - pass an env file as the first argument");
  process.exit(1);
}

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(Buffer.from(b64, "base64").toString("utf-8")),
});

const row = (uuid, ward, date, facility, f30, m30, f60, m60, submitted) =>
  `STRUCT('${uuid}' AS submission_uuid, '${ward}' AS ward_code, DATE '${date}' AS report_date_ad, ` +
  `'${facility}' AS facility_name, ${f30} AS v_30_60_f, ${m30} AS v_30_60_m, ${f60} AS v_60plus_f, ` +
  `${m60} AS v_60plus_m, ${f30 + m30 + f60 + m60} AS total_doses, ` +
  `TIMESTAMP '${submitted}' AS submitted_at, TIMESTAMP '${submitted}' AS ingested_at)`;

const CASES = [
  // The same submission delivered twice by the webhook's retry.
  row("u1", "w_1", "2026-10-05", "Birtamod HP", 10, 12, 3, 4, "2026-10-05 10:00:00"),
  row("u1", "w_1", "2026-10-05", "Birtamod HP", 10, 12, 3, 4, "2026-10-05 10:00:00"),
  // Offline resubmission: new _uuid, same numbers, name typed differently.
  row("u2", "w_1", "2026-10-05", "birtamod h.p.", 10, 12, 3, 4, "2026-10-05 18:30:00"),
  // Same facility and day but different numbers - a correction or a second
  // session. Must survive and be flagged, never silently dropped.
  row("u3", "w_1", "2026-10-05", "Birtamod HP", 5, 6, 1, 2, "2026-10-05 19:00:00"),
  // A different facility in the same ward that happens to match the numbers.
  row("u4", "w_1", "2026-10-05", "Mechi PHC", 10, 12, 3, 4, "2026-10-05 11:00:00"),
  // The same facility reporting again the next day.
  row("u5", "w_1", "2026-10-06", "Birtamod HP", 10, 12, 3, 4, "2026-10-06 10:00:00"),
];

const BASE = `
WITH raw AS (
  SELECT * FROM UNNEST([${CASES.join(",\n    ")}])
),
by_uuid AS (
  SELECT * EXCEPT (row_num) FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY submission_uuid ORDER BY ingested_at DESC) AS row_num
    FROM raw
  ) WHERE row_num = 1
),
named AS (
  SELECT *, LOWER(REGEXP_REPLACE(COALESCE(facility_name, ''), r'[^\\p{L}\\p{N}]', '')) AS facility_name_norm
  FROM by_uuid
),
deduped AS (
  SELECT * EXCEPT (dup_num) FROM (
    SELECT *, ROW_NUMBER() OVER (
      PARTITION BY ward_code, report_date_ad, facility_name_norm,
                   v_30_60_f, v_30_60_m, v_60plus_f, v_60plus_m
      ORDER BY submitted_at, ingested_at
    ) AS dup_num
    FROM named
  ) WHERE dup_num = 1
)`;

const location = process.env.BQ_LOCATION || "asia-south1";
const run = async (sql) => (await bq.query({ query: BASE + sql, location }))[0];

const surviving = await run(`
  SELECT ARRAY_AGG(submission_uuid ORDER BY submission_uuid) AS uuids, SUM(total_doses) AS doses FROM deduped`);
const review = await run(`
  SELECT ward_code, report_date_ad, COUNT(*) AS submission_count, SUM(total_doses) AS combined_doses
  FROM deduped
  GROUP BY ward_code, report_date_ad, facility_name_norm
  HAVING COUNT(*) > 1`);

const checks = [
  ["redelivered _uuid and offline resubmission both collapse",
    surviving[0].uuids.join(",") === "u1,u3,u4,u5"],
  ["totals count each real facility-day once",
    Number(surviving[0].doses) === 29 + 14 + 29 + 29],
  ["exactly one facility-day is queued for review",
    review.length === 1],
  ["the queued facility-day is the correction, with both submissions intact",
    review.length === 1 && Number(review[0].submission_count) === 2 && Number(review[0].combined_doses) === 43],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
}
if (failed > 0) {
  console.log(`\nsurviving: ${JSON.stringify(surviving)}\nreview: ${JSON.stringify(review)}`);
}
process.exit(failed === 0 ? 0 : 1);
