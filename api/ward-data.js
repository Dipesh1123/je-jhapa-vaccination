// One ward's own profile, for /ward/:code and the map's ward drill-down.
// ?code=mechinagar_municipality_7

import { getBigQuery, DATASET, LOCATION } from "./_lib/bigquery.js";
import { flattenRow } from "./_lib/csv.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  const code = req.query.code;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "missing ?code=" });
    return;
  }

  try {
    const bq = getBigQuery();
    const [rows] = await bq.query({
      query: `SELECT * FROM \`${DATASET}.v_ward_cumulative\` WHERE ward_code = @code`,
      params: { code },
      location: LOCATION,
    });

    const ward = rows[0];
    if (!ward) {
      res.status(404).json({ error: `no ward with code '${code}'` });
      return;
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({ ward: flattenRow(ward) });
  } catch (err) {
    console.error("ward-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
