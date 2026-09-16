// Single BigQuery client factory. Every api/ route imports from here, never
// instantiates its own client - this is the seam described in the plan as the
// Sheets-fallback point, should storage ever need to change.

import { BigQuery } from "@google-cloud/bigquery";

let client;

export function getBigQuery() {
  if (client) return client;

  const b64 = process.env.GCP_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error("GCP_SERVICE_ACCOUNT_B64 is not set");
  }
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

  client = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID,
    credentials,
  });
  return client;
}

export const DATASET = process.env.BQ_DATASET || "je_jhapa";
export const LOCATION = process.env.BQ_LOCATION || "asia-south1";

export async function runQuery(sql, params = {}) {
  const bq = getBigQuery();
  const [rows] = await bq.query({ query: sql, params, location: LOCATION });
  return rows;
}
