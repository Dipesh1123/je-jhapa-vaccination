// Stock-on-hand and wastage per ward for /commodity. Joined with palika name
// so the page can group/sort without another lookup.

import { getBigQuery, DATASET, LOCATION } from "./_lib/bigquery.js";
import { flattenRow } from "./_lib/csv.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  try {
    const bq = getBigQuery();
    const [rows] = await bq.query({
      query: `
        SELECT
          c.*,
          w.ward_no,
          ll.name AS local_level_name
        FROM \`${DATASET}.v_commodity_stock\` c
        JOIN \`${DATASET}.ref_ward\` w ON w.code = c.ward_code
        JOIN \`${DATASET}.ref_local_level\` ll ON ll.code = c.local_level_code
        ORDER BY ll.name, w.ward_no
      `,
      location: LOCATION,
    });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({ rows: rows.map(flattenRow) });
  } catch (err) {
    console.error("commodity-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
