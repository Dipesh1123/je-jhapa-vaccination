// Campaign window - must stay in sync with src/lib/nepali.ts's
// CAMPAIGN_START/CAMPAIGN_END (separate files because api/ and src/ are
// separate build contexts) and with data/reference.json's campaign_start/end.
// Confirmed against the daily-reporting sheet's own day-blocks: 11 days,
// Day 1 = 5 Ashwin 2083 (2026-10-05) through Day 11 = 15 Ashwin (2026-10-15).

export const CAMPAIGN_START = "2026-10-05";
export const CAMPAIGN_END = "2026-10-15";

// Reports are filed "end of day" by facilities in Nepal, and the reconcile
// cron already reasons in Nepal time (it runs at 01:45 NPT, deliberately
// after the day's reporting closes - see api/reconcile.js). "Today" for a
// same-day supervision view means Kathmandu's today, not the server's UTC
// today or a viewer's local browser date - Vercel's Node runtime ships full
// ICU, so this needs no extra dependency.
export function todayNpt() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}
