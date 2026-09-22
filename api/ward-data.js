// One ward's own profile, for /ward/:code and the map's ward drill-down.
// ?code=mechinagar_municipality_7

import { WARD_BY_CODE } from "./_lib/reference.js";
import { computeWardSummary } from "./_lib/vaccination.js";

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
    if (!WARD_BY_CODE[code]) {
      res.status(404).json({ error: `no ward with code '${code}'` });
      return;
    }

    const ward = await computeWardSummary(code);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({ ward });
  } catch (err) {
    console.error("ward-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
