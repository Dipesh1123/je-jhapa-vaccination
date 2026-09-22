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
