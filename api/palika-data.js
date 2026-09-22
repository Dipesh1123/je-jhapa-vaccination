// One local level's ward-by-ward detail, for /palika/:slug.
// ?code=mechinagar_municipality

import { LOCAL_LEVEL_BY_CODE } from "./_lib/reference.js";
import { computePalikaSummary, computeWardSummary } from "./_lib/vaccination.js";

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
    const localLevel = LOCAL_LEVEL_BY_CODE[code];
    if (!localLevel) {
      res.status(404).json({ error: `no local level with code '${code}'` });
      return;
    }

    const [palika, wards] = await Promise.all([
      computePalikaSummary(code),
      Promise.all(localLevel.wards.map((w) => computeWardSummary(w.code))),
    ]);

    wards.sort((a, b) => a.ward_no - b.ward_no);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({ palika, wards });
  } catch (err) {
    console.error("palika-data failed", err);
    res.status(500).json({ error: "query failed" });
  }
}
