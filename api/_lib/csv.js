// Shared by every /api/export-* route.

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(",")).join("\r\n");
  // UTF-8 BOM so Excel renders Devanagari text correctly instead of mojibake -
  // same reasoning as src/lib/csvExport.ts on the browser side.
  return "﻿" + header + "\r\n" + body;
}

/** Flattens BigQuery's {value} wrappers (DATE, TIMESTAMP) and Big.js instances
 *  (NUMERIC, BIGNUMERIC) to plain values for CSV/JSON output. Without this,
 *  NUMERIC columns (je_target, coverage_pct, wastage_pct, ...) survive
 *  JSON.stringify as strings - Big.js defines toJSON() - and every frontend
 *  `.toFixed()` call on them throws. */
export function flattenRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object" && v.constructor?.name === "Big") out[k] = Number(v);
    else if (v && typeof v === "object" && "value" in v) out[k] = v.value;
    else if (typeof v === "bigint") out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}
