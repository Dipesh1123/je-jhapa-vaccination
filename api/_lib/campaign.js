// Campaign window - must stay in sync with src/lib/nepali.ts's
// CAMPAIGN_START/CAMPAIGN_END (separate files because api/ and src/ are
// separate build contexts) and with data/reference.json's campaign_start/end
// (scripts/extract_reference.py). All three ultimately trace back to the
// 5-19 Oct 2026 dates reported for the Jhapa campaign launch.

export const CAMPAIGN_START = "2026-10-05";
export const CAMPAIGN_END = "2026-10-19";
