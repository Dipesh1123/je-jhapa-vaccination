// Ported from school-health-nurse/src/lib/csvExport.ts unchanged - reusing the
// house pattern rather than writing a second CSV helper.

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Triggers a browser download of `rows` as a CSV file. A UTF-8 BOM is
 *  prepended so Excel renders Devanagari text correctly instead of mojibake. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const content = rows.map(row => row.map(csvEscape).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
