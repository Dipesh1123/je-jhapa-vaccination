// Campaign window - must stay in sync with src/lib/nepali.ts's
// CAMPAIGN_START/CAMPAIGN_END (separate files because api/ and src/ are
// separate build contexts) and with data/reference.json's campaign_start/end
// (scripts/extract_reference.py). All three ultimately trace back to the
// 5-19 Oct 2026 dates reported for the Jhapa campaign launch.

export const CAMPAIGN_START = "2026-10-05";
export const CAMPAIGN_END = "2026-10-19";

// Reports are filed "end of day" by facilities in Nepal, and the reconcile
// cron already reasons in Nepal time (it runs at 01:45 NPT, deliberately
// after the day's reporting closes - see api/reconcile.js). "Today" for a
// same-day supervision view means Kathmandu's today, not the server's UTC
// today or a viewer's local browser date - Vercel's Node runtime ships full
// ICU, so this needs no extra dependency.
export function todayNpt() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}
