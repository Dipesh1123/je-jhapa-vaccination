// One-off check for the notReportingToday query in api/dashboard-data.js -
// run directly since that query is gated behind `campaignActive` and won't
// execute for real until 5 Oct 2026, so a CAST/type error would otherwise
// surface for the first time on launch day.
//
//   vercel env pull .env.production --environment=production
//   node scripts/validate_non_reporting_sql.mjs .env.production
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

const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT_B64, "base64").toString("utf-8")),
});

const [rows] = await bq.query({
  query: `
    SELECT ward_code, local_level_code, local_level_name, ward_no, population, last_report_date
    FROM \`je_jhapa.v_ward_cumulative\`
    WHERE last_report_date IS NULL OR last_report_date != CAST(@today AS DATE)
    ORDER BY local_level_name, ward_no`,
  params: { today: "2026-10-06" },
  location: "asia-south1",
});

console.log("PASS  query runs against BigQuery with no type error");
console.log(`rows returned: ${rows.length} (expect 131, since no ward has reported yet)`);
console.log("sample:", JSON.stringify(rows[0]));
process.exit(rows.length === 131 ? 0 : 1);
