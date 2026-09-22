// Campaign window - must stay in sync with src/lib/nepali.ts's
// CAMPAIGN_START/CAMPAIGN_END (separate files because api/ and src/ are
// separate build contexts) and with data/reference.json's campaign_start/end.
// 11-day window (matches the daily-reporting sheet's 11 day-blocks), shifted
// to start 2026-09-21 so the campaign reads as actually underway.

export const CAMPAIGN_START = "2026-09-21";
export const CAMPAIGN_END = "2026-10-01";

// Reports are filed "end of day" by facilities in Nepal, and the reconcile
// cron already reasons in Nepal time (it runs at 01:45 NPT, deliberately
// after the day's reporting closes - see api/reconcile.js). "Today" for a
// same-day supervision view means Kathmandu's today, not the server's UTC
// today or a viewer's local browser date - Vercel's Node runtime ships full
// ICU, so this needs no extra dependency.
export function todayNpt() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}
