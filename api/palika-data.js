// One local level's ward-by-ward detail, for /palika/:slug.
// ?code=mechinagar_municipality

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
    const [[palika], wards] = await Promise.all([
      bq.query({
        query: `SELECT * FROM \`${DATASET}.v_local_level_cumulative\` WHERE local_level_code = @code`,
        params: { code },
        location: LOCATION,
      }).then(([rows]) => rows),
      bq.query({
        query: `SELECT * FROM \`${DATASET}.v_ward_cumulative\` WHERE local_level_code = @code ORDER BY ward_no`,
        params: { code },
        location: LOCATION,
      }).then(([rows]) => rows),
    ]);

    if (!palika) {
      res.status(404).json({ error: `no local level with code '${code}'` });
      return;
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({
      palika: flattenRow(palika),
      wards: wards.map(flattenRow),
    });
  } catch (err) {
    console.error("palika-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
