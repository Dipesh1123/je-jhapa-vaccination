// Daily full pull from the KoBo API - the source of truth. KoBo's REST
// Service webhook fires only on create, so an edited submission is never
// re-sent; this is what corrects the record. Truncate + reload makes the
// whole pipeline idempotent regardless of how many times the webhook
// retried or this cron has already run today.
//
// Scheduled via vercel.json ("crons": [{"path": "/api/reconcile", "schedule": "0 20 * * *"}])
// - 20:00 UTC = 01:45 NPT the next day, after the day's reporting closes.

import { getBigQuery, DATASET, LOCATION } from "./_lib/bigquery.js";
import { mapSubmission } from "./_lib/kobo.js";

const PAGE_SIZE = 1000;

async function fetchAllSubmissions() {
  const base = process.env.KOBO_API_URL || "https://kf.kobotoolbox.org";
  const uid = process.env.KOBO_ASSET_UID;
  const token = process.env.KOBO_API_TOKEN;
  if (!uid || !token) throw new Error("KOBO_ASSET_UID / KOBO_API_TOKEN not set");

  const all = [];
  let start = 0;
  for (;;) {
    const url = `${base}/api/v2/assets/${uid}/data/?format=json&limit=${PAGE_SIZE}&start=${start}`;
    const resp = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    if (!resp.ok) {
      throw new Error(`KoBo API ${resp.status}: ${await resp.text()}`);
    }
    const page = await resp.json();
    all.push(...page.results);
    if (page.results.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return all;
}

export default async function handler(req, res) {
  // Vercel identifies its own cron trigger via the "x-vercel-cron-schedule"
  // header and a "vercel-cron/1.0" user-agent - there is no boolean flag.
  // Also allow a manual trigger with the webhook secret, so this can be
  // re-run by hand after a fix without waiting for the next scheduled run.
  const isCron = Boolean(req.headers["x-vercel-cron-schedule"]);
  const secretOk = req.headers["x-webhook-secret"] === process.env.KOBO_WEBHOOK_SECRET;
  if (!isCron && !secretOk) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  try {
    const submissions = await fetchAllSubmissions();

    const rows = [];
    const errors = [];
    for (const raw of submissions) {
      try {
        rows.push(mapSubmission(raw));
      } catch (err) {
        errors.push({ uuid: raw._uuid, error: err.message });
      }
    }

    const bq = getBigQuery();
    const table = `\`${bq.projectId}.${DATASET}.reports\``;

    // TRUNCATE + reload in one job so a mid-run failure can't leave the
    // table half-emptied - the query either fully replaces the data or the
    // table is untouched.
    await bq.query({
      query: `TRUNCATE TABLE ${table}`,
      location: LOCATION,
    });

    if (rows.length > 0) {
      await bq.dataset(DATASET).table("reports").insert(rows, { ignoreUnknownValues: false });
    }

    res.status(200).json({
      fetched: submissions.length,
      loaded: rows.length,
      skipped: errors.length,
      errors: errors.slice(0, 20), // cap so a mass failure doesn't blow up the response
    });
  } catch (err) {
    console.error("reconcile failed", err.message);
    res.status(500).json({ error: err.message });
  }
}

export const config = { maxDuration: 60 };
