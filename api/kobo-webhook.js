// Receives KoBo's REST Service POST on every new submission (create only -
// see api/reconcile.js for how edits get picked up). Configure in KoBo:
//   Form -> Settings -> REST Services -> Add new REST Service
//     URL:     https://<this-deployment>/api/kobo-webhook
//     Format:  JSON
//     Custom HTTP header:  X-Webhook-Secret: <KOBO_WEBHOOK_SECRET>

import { getBigQuery, DATASET } from "./_lib/bigquery.js";
import { mapSubmission } from "./_lib/kobo.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== process.env.KOBO_WEBHOOK_SECRET) {
    res.status(401).json({ error: "bad or missing X-Webhook-Secret" });
    return;
  }

  let row;
  try {
    row = mapSubmission(req.body);
  } catch (err) {
    // A malformed submission should not make KoBo retry forever (60s/600s/6000s
    // then give up) - acknowledge with 200 so it doesn't clog the retry queue,
    // but log loudly so it's caught before the next reconcile.
    console.error("kobo-webhook: mapping failed", err.message, JSON.stringify(req.body));
    res.status(200).json({ accepted: false, reason: err.message });
    return;
  }

  try {
    const bq = getBigQuery();
    const table = bq.dataset(DATASET).table("reports");
    await table.insert([row], { ignoreUnknownValues: false });
    res.status(200).json({ accepted: true, submission_uuid: row.submission_uuid });
  } catch (err) {
    console.error("kobo-webhook: BigQuery insert failed", err.message);
    // 500 here IS what we want KoBo to retry on - a transient BQ failure
    // should not silently drop a submission.
    res.status(500).json({ error: "insert failed" });
  }
}

// No `bodyParser` config exists for this function style (that key is
// Next.js Pages Router only) - the only valid config keys here are
// `runtime`, `regions` and `maxDuration`. Vercel's own platform-level
// request-body limit applies by default; no per-function override needed
// at our payload size (~1KB per submission).
