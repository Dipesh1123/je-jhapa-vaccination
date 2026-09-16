// Applies scripts/bq_schema.sql to BigQuery using the same service-account
// credentials the deployed API uses, so a schema change can go out without the
// `bq` CLI installed locally. Every statement in that file is idempotent
// (CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE VIEW), so re-running it just
// makes BigQuery match the file.
//
// Credentials come from the environment. To use the deployed ones:
//   vercel env pull .env.production --environment=production
//   node scripts/apply_bq_schema.mjs .env.production
//   rm .env.production        <- it contains the service-account key

import { BigQuery } from "@google-cloud/bigquery";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const sql = readFileSync(resolve(ROOT, "scripts/bq_schema.sql"), "utf-8");

// BigQuery runs a semicolon-separated script as a single multi-statement job,
// so the file goes over as-is rather than being split here.
const [job] = await bq.createQueryJob({
  query: sql,
  location: process.env.BQ_LOCATION || "asia-south1",
});
await job.getQueryResults();

console.log(`applied scripts/bq_schema.sql (job ${job.id})`);
